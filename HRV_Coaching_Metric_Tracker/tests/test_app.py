"""End-to-end tests over the real app, against a throwaway SQLite file.

The bulk of these exercise the role boundary, because that is the thing this
app must not get wrong: an employee must not be able to read a colleague's
coaching log or recording, by any route, including by asking for one directly.

Run with ``python -m pytest tests`` from the project root, or plain
``python tests/test_app.py`` if pytest is not installed.
"""

from __future__ import annotations

import io
import math
import os
import struct
import sys
import tempfile
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from hrvcoach import auth, create_app, db, metrics, recordings, validation  # noqa: E402


# --- fixtures --------------------------------------------------------------

@pytest.fixture()
def app():
    handle, path = tempfile.mkstemp(suffix=".sqlite3")
    os.close(handle)
    os.unlink(path)  # sqlite3 creates it; an empty file would look "seeded"
    application = create_app({
        "DATABASE": path,
        "DATABASE_URL": None,
        "TESTING": True,
        "SECRET_KEY": "test",
        "SEED_DEMO": True,
        "SESSION_COOKIE_SECURE": False,
    })
    yield application
    db._initialised.clear()
    for suffix in ("", "-wal", "-shm"):
        try:
            os.unlink(path + suffix)
        except OSError:
            pass


@pytest.fixture()
def client(app):
    return app.test_client()


def sign_in(client, employee_id, password="coach1234"):
    return client.post(
        "/login", data={"employee_id": employee_id, "password": password}, follow_redirects=False
    )


def wav_bytes(seconds=1):
    """A real WAV, so the upload sniffing has something honest to look at."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as handle:
        path = handle.name
    with wave.open(path, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(8000)
        writer.writeframes(
            b"".join(struct.pack("<h", int(9000 * math.sin(i * 0.05))) for i in range(8000 * seconds))
        )
    data = Path(path).read_bytes()
    os.unlink(path)
    return data


def uid_of(client, employee_id):
    """The numeric id behind an employee code, read as the signed-in admin."""
    people = client.get("/api/employees").get_json()["employees"]
    return [p for p in people if p["employee_id"] == employee_id][0]["id"]


# --- unit-level ------------------------------------------------------------

def test_week_start_snaps_to_monday():
    # Sat 2026-09-05 and Thu 2026-09-03 belong to the week starting Mon 08-31.
    assert metrics.week_start_str("2026-09-05") == "2026-08-31"
    assert metrics.week_start_str("2026-09-03") == "2026-08-31"
    assert metrics.week_start_str("2026-08-31") == "2026-08-31"


def test_improvement_follows_metric_direction():
    # A falling AHT is a win; a falling QA score is not. Sign alone cannot say.
    assert metrics.improved("aht", -0.4) is True
    assert metrics.improved("qa", -0.4) is False
    assert metrics.improved("qa", 0) is None


def test_range_header_parsing():
    assert recordings.parse_range("bytes=0-99", 500) == (0, 99)
    assert recordings.parse_range("bytes=-100", 500) == (400, 499)
    assert recordings.parse_range("bytes=10-", 500) == (10, 499)
    # Unsatisfiable or unparseable windows fall back to "send everything".
    assert recordings.parse_range("bytes=600-", 500) is None
    assert recordings.parse_range("items=0-5", 500) is None
    assert recordings.parse_range(None, 500) is None


def test_upload_name_is_stripped_of_path_and_quotes():
    assert recordings.safe_name('../../etc/we"ird.mp3') == "weird.mp3"


def test_metric_value_bounds():
    with pytest.raises(validation.Invalid):
        validation.metric_value(140, "qa")
    assert validation.metric_value("88.5", "qa") == 88.5


# --- auth ------------------------------------------------------------------

def test_dashboard_requires_a_session(client):
    assert client.get("/", follow_redirects=False).status_code == 302


def test_wrong_password_is_rejected(client):
    assert sign_in(client, "TL-001", "not-the-password").status_code == 401


def test_unknown_and_wrong_password_give_the_same_answer(client):
    """Otherwise the login form becomes an employee-ID oracle."""
    missing = sign_in(client, "NOBODY-1", "coach1234")
    wrong = sign_in(client, "TL-001", "wrong-password")
    assert missing.status_code == wrong.status_code == 401
    assert b"do not match an active account" in missing.data
    assert b"do not match an active account" in wrong.data


def test_login_does_not_redirect_off_site(client):
    response = client.post(
        "/login",
        data={"employee_id": "TL-001", "password": "coach1234", "next": "https://evil.example/"},
    )
    assert response.headers["Location"] in ("/", "http://localhost/")


def test_deactivated_account_cannot_sign_in(client):
    sign_in(client, "TL-001")
    target = uid_of(client, "EMP-104")
    client.patch(f"/api/employees/{target}", json={"active": False})
    client.post("/logout")
    assert sign_in(client, "EMP-104").status_code == 401


def test_last_admin_cannot_be_demoted_or_deactivated(client):
    sign_in(client, "TL-001")
    admin = uid_of(client, "TL-001")
    assert client.patch(f"/api/employees/{admin}", json={"role": "employee"}).status_code == 409
    assert client.patch(f"/api/employees/{admin}", json={"active": False}).status_code == 409


def test_password_change_needs_the_current_password(client):
    sign_in(client, "EMP-101")
    assert client.post("/api/password", json={"current": "nope", "new": "brandnew123"}).status_code == 400
    assert client.post("/api/password", json={"current": "coach1234", "new": "brandnew123"}).status_code == 200
    client.post("/logout")
    assert sign_in(client, "EMP-101", "brandnew123").status_code == 302


# --- the role boundary -----------------------------------------------------

def test_employee_sees_only_their_own_logs_even_when_asking_for_another(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    client.post("/logout")

    sign_in(client, "EMP-103")
    everyone = client.get("/api/logs").get_json()["logs"]
    assert {log["employee_code"] for log in everyone} == {"EMP-103"}

    # Explicitly asking for a colleague's rows returns their own, not an error -
    # the filter is in the SQL, so there is nothing to leak.
    targeted = client.get(f"/api/logs?employee_uid={aaron}").get_json()["logs"]
    assert {log["employee_code"] for log in targeted} == {"EMP-103"}


def test_employee_metrics_are_scoped_to_themselves(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    client.post("/logout")

    sign_in(client, "EMP-103")
    payload = client.get(f"/api/metrics?employee_uid={aaron}").get_json()
    assert payload["subject"]["full_name"] == "Carlo Mendoza"
    # The team average is still there as context - it identifies nobody.
    assert payload["has_comparison"] is True


def test_employee_roster_is_only_themselves(client):
    sign_in(client, "EMP-101")
    people = client.get("/api/employees").get_json()["employees"]
    assert [p["employee_id"] for p in people] == ["EMP-101"]


@pytest.mark.parametrize(
    "method, path, payload",
    [
        ("post", "/api/logs", {"employee_uid": 2, "session_date": "2026-09-01",
                               "category": "Recognition", "opportunity": "a", "action_plan": "b"}),
        ("post", "/api/metrics", {"employee_uid": 2, "week_start": "2026-09-01", "values": {"qa": 100}}),
        ("post", "/api/employees", {"employee_id": "HACK-1", "full_name": "x",
                                    "password": "12345678", "role": "admin"}),
        ("get", "/api/metrics/week?employee_uid=2&week_start=2026-09-01", None),
    ],
)
def test_employee_cannot_reach_admin_endpoints(client, method, path, payload):
    sign_in(client, "EMP-101")
    call = getattr(client, method)
    response = call(path, json=payload) if payload else call(path)
    assert response.status_code == 403


def test_employee_may_acknowledge_but_not_edit_their_own_log(client):
    sign_in(client, "TL-001")
    carlo = uid_of(client, "EMP-101")
    created = client.post("/api/logs", json={
        "employee_uid": carlo, "session_date": "2026-09-01", "category": "Recognition",
        "opportunity": "Great week", "action_plan": "Keep it up",
    }).get_json()["log"]
    client.post("/logout")

    sign_in(client, "EMP-101")
    edit = client.patch(f"/api/logs/{created['id']}", json={"action_plan": "nothing to do"})
    assert edit.status_code == 403

    ack = client.patch(f"/api/logs/{created['id']}", json={"acknowledge": True})
    assert ack.status_code == 200
    assert ack.get_json()["log"]["acknowledged_at"]
    # The acknowledgement must not have carried the rejected edit with it.
    assert ack.get_json()["log"]["action_plan"] == "Keep it up"


def test_employee_cannot_acknowledge_someone_elses_log(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    created = client.post("/api/logs", json={
        "employee_uid": aaron, "session_date": "2026-09-01", "category": "Recognition",
        "opportunity": "x", "action_plan": "y",
    }).get_json()["log"]
    client.post("/logout")

    sign_in(client, "EMP-103")
    assert client.patch(f"/api/logs/{created['id']}", json={"acknowledge": True}).status_code == 403


# --- coaching logs ---------------------------------------------------------

def test_create_log_validates_required_fields(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    response = client.post("/api/logs", json={
        "employee_uid": aaron, "session_date": "2026-09-01",
        "category": "Recognition", "opportunity": "x",
    })
    assert response.status_code == 400
    assert response.get_json()["field"] == "action_plan"


def test_create_log_rejects_an_unknown_category(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    response = client.post("/api/logs", json={
        "employee_uid": aaron, "session_date": "2026-09-01",
        "category": "Whatever", "opportunity": "x", "action_plan": "y",
    })
    assert response.status_code == 400
    assert response.get_json()["field"] == "category"


def test_log_week_is_derived_from_the_session_date(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    log = client.post("/api/logs", json={
        "employee_uid": aaron, "session_date": "2026-09-03", "category": "Recognition",
        "opportunity": "x", "action_plan": "y",
    }).get_json()["log"]
    assert log["week_start"] == "2026-08-31"


def test_deleting_a_log_takes_its_recordings_with_it(client, app):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    log = client.post("/api/logs", data={
        "employee_uid": str(aaron), "session_date": "2026-09-01", "category": "Quality / QA",
        "opportunity": "x", "action_plan": "y",
        "recording": (io.BytesIO(wav_bytes()), "call.wav"),
    }, content_type="multipart/form-data").get_json()["log"]
    recording_id = log["recordings"][0]["id"]

    assert client.delete(f"/api/logs/{log['id']}").status_code == 200
    assert client.get(f"/api/recordings/{recording_id}").status_code == 404


# --- recordings ------------------------------------------------------------

def test_upload_and_stream_a_recording(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    audio = wav_bytes()
    log = client.post("/api/logs", data={
        "employee_uid": str(aaron), "session_date": "2026-09-01", "category": "Quality / QA",
        "opportunity": "Missed verification", "action_plan": "Re-read the flow",
        "call_ref": "INT-1", "recording": (io.BytesIO(audio), "call.wav"),
    }, content_type="multipart/form-data").get_json()["log"]

    attachment = log["recordings"][0]
    assert attachment["content_type"] == "audio/wav"
    assert attachment["size_bytes"] == len(audio)
    assert attachment["call_ref"] == "INT-1"

    whole = client.get(f"/api/recordings/{attachment['id']}")
    assert whole.status_code == 200
    assert whole.data == audio
    assert whole.headers["X-Content-Type-Options"] == "nosniff"

    part = client.get(f"/api/recordings/{attachment['id']}", headers={"Range": "bytes=0-99"})
    assert part.status_code == 206
    assert part.headers["Content-Range"] == f"bytes 0-99/{len(audio)}"
    assert part.data == audio[:100]


def test_a_disguised_file_is_refused_but_the_log_survives(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    response = client.post("/api/logs", data={
        "employee_uid": str(aaron), "session_date": "2026-09-01", "category": "Quality / QA",
        "opportunity": "x", "action_plan": "y",
        "recording": (io.BytesIO(b"<html>not audio</html>"), "call.mp3"),
    }, content_type="multipart/form-data")

    assert response.status_code == 201
    body = response.get_json()
    assert body["warning"]
    assert body["log"]["recordings"] == []  # the log is kept; the file is not


def test_a_non_audio_extension_is_refused(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    log = client.post("/api/logs", json={
        "employee_uid": aaron, "session_date": "2026-09-01", "category": "Quality / QA",
        "opportunity": "x", "action_plan": "y",
    }).get_json()["log"]

    response = client.post(f"/api/logs/{log['id']}/recordings", data={
        "recording": (io.BytesIO(b"MZ\x90\x00"), "payload.exe"),
    }, content_type="multipart/form-data")
    assert response.status_code == 400
    assert "audio file" in response.get_json()["error"]


def test_an_employee_cannot_stream_a_colleagues_recording(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    log = client.post("/api/logs", data={
        "employee_uid": str(aaron), "session_date": "2026-09-01", "category": "Quality / QA",
        "opportunity": "x", "action_plan": "y",
        "recording": (io.BytesIO(wav_bytes()), "call.wav"),
    }, content_type="multipart/form-data").get_json()["log"]
    recording_id = log["recordings"][0]["id"]
    client.post("/logout")

    sign_in(client, "EMP-103")
    assert client.get(f"/api/recordings/{recording_id}").status_code == 403
    client.post("/logout")

    # The employee the log is about can hear it.
    sign_in(client, "EMP-101")
    assert client.get(f"/api/recordings/{recording_id}").status_code == 200


def test_an_oversized_upload_is_refused(app):
    app.config["MAX_RECORDING_BYTES"] = 4096
    app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024
    client = app.test_client()
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    log = client.post("/api/logs", json={
        "employee_uid": aaron, "session_date": "2026-09-01", "category": "Quality / QA",
        "opportunity": "x", "action_plan": "y",
    }).get_json()["log"]

    response = client.post(f"/api/logs/{log['id']}/recordings", data={
        "recording": (io.BytesIO(wav_bytes()), "call.wav"),
    }, content_type="multipart/form-data")
    assert response.status_code == 400
    assert "capped at" in response.get_json()["error"]


# --- metrics ---------------------------------------------------------------

def test_writing_a_week_snaps_to_monday_and_upserts(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")

    first = client.post("/api/metrics", json={
        "employee_uid": aaron, "week_start": "2026-09-03", "values": {"qa": 88.5, "csat": 81},
    })
    assert first.get_json() == {"ok": True, "written": 2, "week_start": "2026-08-31"}

    # Re-saving the same week corrects it rather than adding a second row.
    client.post("/api/metrics", json={
        "employee_uid": aaron, "week_start": "2026-08-31", "values": {"qa": 91},
    })
    stored = client.get(f"/api/metrics/week?employee_uid={aaron}&week_start=2026-08-31").get_json()
    assert stored["values"]["qa"] == 91


def test_a_blank_value_clears_the_week_rather_than_storing_zero(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    client.post("/api/metrics", json={
        "employee_uid": aaron, "week_start": "2026-08-31", "values": {"qa": 88},
    })
    client.post("/api/metrics", json={
        "employee_uid": aaron, "week_start": "2026-08-31", "values": {"qa": ""},
    })
    stored = client.get(f"/api/metrics/week?employee_uid={aaron}&week_start=2026-08-31").get_json()
    assert "qa" not in stored["values"]


def test_out_of_range_and_unknown_metrics_are_refused(client):
    sign_in(client, "TL-001")
    aaron = uid_of(client, "EMP-101")
    too_big = client.post("/api/metrics", json={
        "employee_uid": aaron, "week_start": "2026-08-31", "values": {"qa": 500},
    })
    assert too_big.status_code == 400 and too_big.get_json()["field"] == "qa"

    unknown = client.post("/api/metrics", json={
        "employee_uid": aaron, "week_start": "2026-08-31", "values": {"nps": 50},
    })
    assert unknown.status_code == 400


def test_a_missing_week_stays_a_gap_in_the_series(client):
    """A hole must reach the chart as null, never as an interpolated number."""
    sign_in(client, "TL-001")
    fresh = client.post("/api/employees", json={
        "employee_id": "EMP-777", "full_name": "Gap Tester", "password": "12345678",
    }).get_json()["employee"]

    weeks = metrics.recent_weeks(4)
    client.post("/api/metrics", json={
        "employee_uid": fresh["id"], "week_start": weeks[0], "values": {"qa": 80},
    })
    client.post("/api/metrics", json={
        "employee_uid": fresh["id"], "week_start": weeks[3], "values": {"qa": 90},
    })

    payload = client.get(f"/api/metrics?employee_uid={fresh['id']}&weeks=4").get_json()
    qa = [s for s in payload["series"] if s["key"] == "qa"][0]
    assert qa["values"] == [80.0, None, None, 90.0]
    # The delta skips the gap: it compares the two readings that exist.
    assert qa["delta"] == 10.0
    assert qa["improved"] is True


def test_metric_payload_shape_matches_what_the_charts_need(client):
    sign_in(client, "EMP-101")
    payload = client.get("/api/metrics?weeks=12").get_json()
    assert len(payload["weeks"]) == 12
    assert len(payload["week_labels"]) == 12
    assert len(payload["week_ticks"]) == 12
    assert {s["key"] for s in payload["series"]} == set(metrics.METRIC_KEYS)
    for series in payload["series"]:
        # One value slot per week, per series, for both lines.
        assert len(series["values"]) == 12
        assert len(series["team"]) == 12
        assert series["direction"] in ("up", "down")


def test_weeks_range_is_clamped(client):
    sign_in(client, "EMP-101")
    assert len(client.get("/api/metrics?weeks=999").get_json()["weeks"]) == 52
    assert len(client.get("/api/metrics?weeks=1").get_json()["weeks"]) == 4


def test_admin_overview_uses_the_team_average_and_offers_no_comparison(client):
    sign_in(client, "TL-001")
    payload = client.get("/api/metrics?employee_uid=all").get_json()
    assert payload["subject"]["id"] is None
    # Comparing the team average against itself would be a second identical
    # line, so the overview is deliberately single-series.
    assert payload["has_comparison"] is False


# --- health & seed ---------------------------------------------------------

def test_healthz_reports_the_backend(client):
    body = client.get("/healthz").get_json()
    assert body["ok"] is True
    assert body["database"] == "sqlite"


def test_demo_seed_creates_one_admin_and_four_employees(client):
    sign_in(client, "TL-001")
    people = client.get("/api/employees").get_json()["employees"]
    assert sum(1 for p in people if p["role"] == "admin") == 1
    assert sum(1 for p in people if p["role"] == "employee") == 4


def test_seed_does_not_run_twice(app):
    with app.app_context():
        db.get_db()
        before = db.count_users()
        from hrvcoach import sampledata
        assert sampledata.seed_if_empty(db.get_db()) is False
        assert db.count_users() == before


def test_roles_are_exactly_two():
    assert auth.ROLES == ("admin", "employee")


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
