from database import Database
from user import User
def menu():
    print("Welcome to the Practice App!")
    print("\n Please select an option:")
    print("1. Register")
    print("2. Login")
    print("3. Exit")

def main():
    #initialize database
    db = Database(Database.DB_NAME)
    db.create_table()

    #call menu function to display options
    menu()

    #choice
    choice = input("Enter your choice (1-3):")

    if choice == "1":
        #registration logic will be called here
        User.register()
        menu()  # Call the menu function again after registration
    elif choice == "2":
        #login logic will be called here
        User.login()
    else:
        print("Exiting the application. Goodbye!")

if __name__ == "__main__":
    main()