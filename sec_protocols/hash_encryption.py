import hashlib
import os

def hash_password(password: str) -> str:
    salt = os.urandom(16)

    key = hashlib.pbkdf2_hmac(
        'sha256', 
        password.encode('utf-8'), 
        salt, 
        100000
    )
    
    return f"{salt.hex()}${key.hex()}"

def try_password(password: str, hashed_password: str) -> bool:
    salt_hex, key_hex = hashed_password.split('$')
    salt = bytes.fromhex(salt_hex)
    key = bytes.fromhex(key_hex)

    new_key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt,
        100000
    )
    return new_key == key

"""
if __name__ == "__main__":
    psw = "1234"
    hashed = hash_password(psw)
    print(f"Normal Passwort : {psw}\nHashed password: {hashed}")
    new_psw = input("Password: ")
    is_valid = try_password(new_psw, hashed)
    print(f"Passwort gültig: {is_valid}")
"""