import hashlib
import secrets
import sqlite3
from database import Database


class User:
    def __init__(self, name, password):
        self.name = name
        self.password = password

    #registration logic
    @staticmethod
    def register():
        username = input("Enter your username: ")
        password = input("Enter your password: ")

        if not username or not password:
            print("Username and password cannot be empty.")
            return

        password_hash, salt = User.hash_password(password)

        conn = Database.get_connection()
        cursor = conn.cursor()

        try:
            cursor.execute (
                "INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)",
                (username, password_hash, salt)
            )

            conn.commit()
            print("User registration successfull!")
        except sqlite3.IntegrityError:
            print("The username is already taken. Please enter a different username.")
        finally:
            conn.close()

        

    #login logic
    @staticmethod
    def login():
        username = input("Enter your username: ").strip()
        password = input("Enter your password: ").strip()

        conn = Database.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT password_hash, salt FROM users WHERE username = ?", (username,),)
        result = cursor.fetchone()
        conn.close()

        if result is None:
            print("Invalid username or password.")
            return

        stored_hash, salt = result
        attempt_hash = User.hash_password(password, salt)[0]

        if secrets.compare_digest(stored_hash, attempt_hash):
            print("Login successful!")
        else:
            print("Invalid username or password.")
    
    #password hashing logic
    @staticmethod
    def hash_password(password, salt=None):
        if salt is None:
            salt = secrets.token_hex(16) #this generates a random salt for password hashing
        hashed_password = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), 100000)
        return hashed_password.hex(), salt