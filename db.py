import pyodbc

# Database Configuration
server = r"LAPTOP-OGJ9GR0I\SQLEXPRESS"  # Update this with your server name
database = "HospitalManagementSystem"
driver = "{ODBC Driver 17 for SQL Server}"

def get_db_connection():
    """
    Creates and returns a database connection.
    Raises an exception if connection fails.
    """
    try:
        connection_string = (
            f"DRIVER={driver};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"Trusted_Connection=yes;"
        )
        
        conn = pyodbc.connect(connection_string)
        conn.autocommit = False  # Use manual commit for better control
        return conn
        
    except pyodbc.Error as e:
        print(f"Database connection error: {e}")
        raise Exception("Unable to connect to database. Please check your configuration.")


def test_connection():
    """
    Test the database connection.
    Returns True if successful, False otherwise.
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        print("✅ Database connection successful!")
        return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False


if __name__ == "__main__":
    # Test the connection when running this file directly
    test_connection()