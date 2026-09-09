import sqlite3

class Database:
    DB_NAME = "practice.db"
    def __init__(self, db_name):
        self.connection = sqlite3.Connection(db_name)
        self.cursor = self.connection.cursor()

    @staticmethod
    def get_connection():
        return sqlite3.connect(Database.DB_NAME)


    def create_table(self):
        self.cursor.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL)""")

        self.connection.commit()
        self.connection.close()


