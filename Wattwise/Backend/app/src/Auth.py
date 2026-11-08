from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from AuthSchemas import RegisterRequest, LoginRequest, TokenResponse
from Security import hash_password, verify_password, create_access_token, verify_access_token
from database import get_user_by_email, create_user, get_user_by_id
#Auth router
router = APIRouter(prefix="/auth", tags=["Authentication"])

#Bearer token auth
bearer_scheme = HTTPBearer()

#REGISTER
@router.post("/register")
def register(user: RegisterRequest):
    #checks if email is already registered
    existing_user = get_user_by_email(user.email)

    if existing_user:
        raise HTTPException(status_code=409, detail="Email is already registered")


    # hash password before storage
    hashed_password = hash_password(user.password)

    #save user to database
    new_user = create_user(name= user.name, email= user.email, password_hash= hashed_password)

    return {
        "message": "Account created successfully",
        "user_id": new_user["user_id"],
        "name": new_user["name"],
        "email": new_user["email"]

    }

#LOGIN
@router.post("/login", response_model=TokenResponse)
def login(user: LoginRequest):

    #Find user using email
    existing_user = get_user_by_email(user.email)

    if not existing_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    #verify password
    if not verify_password(user.password, existing_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    #generate JWT
    token = create_access_token(existing_user["user_id"])

    return{"access_token": token, "token_type": "bearer"}

# GET CURRENT USER
@router.get("/user")
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):

    user_id = verify_access_token(credentials.credentials)

    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    existing_user = get_user_by_id(user_id)

    if not existing_user:
        raise HTTPException(status_code=401, detail="User not found ")

    return{
        "user_id": existing_user["user_id"],
        "name": existing_user["name"],
        "email": existing_user["email"]
    }