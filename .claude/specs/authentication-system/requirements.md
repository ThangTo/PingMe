# Requirements Document

## Introduction

Hệ thống Authentication cho ứng dụng PingMe - một ứng dụng nhắn tin và gọi điện real-time. Hệ thống này cung cấp khả năng đăng ký, đăng nhập, và quản lý phiên làm việc của người dùng một cách bảo mật sử dụng JWT (JSON Web Tokens).

## Glossary

- **System**: Hệ thống Authentication của PingMe
- **User**: Người dùng của ứng dụng PingMe
- **JWT**: JSON Web Token - token được sử dụng để xác thực
- **Access_Token**: Token ngắn hạn để truy cập API (15 phút)
- **Refresh_Token**: Token dài hạn để làm mới Access Token (7 ngày)
- **Auth_Service**: Service xử lý logic authentication
- **Password_Hash**: Mật khẩu đã được mã hóa bằng bcrypt
- **Client**: Ứng dụng frontend (React)
- **API**: Backend REST API endpoints
- **Database**: MongoDB database lưu trữ user data

## Requirements

### Requirement 1: User Registration

**User Story:** As a new user, I want to register an account with username, email and password, so that I can access the PingMe application.

#### Acceptance Criteria

1. WHEN a user submits registration form with valid username, email and password, THEN THE System SHALL create a new user account and return success response
2. WHEN a user submits registration with username less than 3 characters, THEN THE System SHALL reject the registration and return validation error
3. WHEN a user submits registration with username more than 30 characters, THEN THE System SHALL reject the registration and return validation error
4. WHEN a user submits registration with invalid email format, THEN THE System SHALL reject the registration and return validation error
5. WHEN a user submits registration with password less than 6 characters, THEN THE System SHALL reject the registration and return validation error
6. WHEN a user submits registration with email that already exists, THEN THE System SHALL reject the registration and return error message
7. WHEN a valid user is created, THEN THE System SHALL hash the password using bcrypt before storing in database
8. WHEN a valid user is created, THEN THE System SHALL NOT return the password in the response
9. WHEN a valid user is created, THEN THE System SHALL set default avatar URL for the user
10. WHEN a valid user is created, THEN THE System SHALL set provider field to "local"
11. WHERE multiple users have same username, THE System SHALL allow registration as username is not unique

### Requirement 2: User Login

**User Story:** As a registered user, I want to login with my email and password, so that I can access my account and use the application.

#### Acceptance Criteria

1. WHEN a user submits login with valid email and password, THEN THE System SHALL authenticate the user and return access token and refresh token
2. WHEN a user submits login with non-existent email, THEN THE System SHALL reject the login and return authentication error
3. WHEN a user submits login with incorrect password, THEN THE System SHALL reject the login and return authentication error
4. WHEN a user submits login with empty email or password, THEN THE System SHALL reject the login and return validation error
5. WHEN a successful login occurs, THEN THE System SHALL return user information without password field
6. WHEN a successful login occurs, THEN THE System SHALL generate JWT access token with 15 minute expiration
7. WHEN a successful login occurs, THEN THE System SHALL generate JWT refresh token with 7 day expiration
8. WHEN a successful login occurs, THEN THE System SHALL include user ID in the JWT payload
9. WHEN a successful login occurs, THEN THE System SHALL update user's lastSeen timestamp in database
10. WHEN comparing passwords, THEN THE System SHALL use bcrypt compare function to verify password hash

### Requirement 3: Token Management

**User Story:** As a logged-in user, I want my session to be managed securely with tokens, so that my account remains protected.

#### Acceptance Criteria

1. WHEN generating access token, THEN THE System SHALL sign the token with JWT secret key
2. WHEN generating access token, THEN THE System SHALL include user ID and email in token payload
3. WHEN generating access token, THEN THE System SHALL set expiration time to 15 minutes
4. WHEN generating refresh token, THEN THE System SHALL sign the token with separate refresh secret key
5. WHEN generating refresh token, THEN THE System SHALL set expiration time to 7 days
6. WHEN a client sends request with access token, THEN THE System SHALL verify the token signature
7. WHEN a client sends expired access token, THEN THE System SHALL reject the request and return token expired error
8. WHEN a client sends invalid access token, THEN THE System SHALL reject the request and return invalid token error
9. WHEN a client sends request without access token to protected endpoint, THEN THE System SHALL reject the request and return unauthorized error

### Requirement 4: Token Refresh

**User Story:** As a logged-in user, I want to refresh my access token when it expires, so that I can continue using the application without logging in again.

#### Acceptance Criteria

1. WHEN a client sends valid refresh token, THEN THE System SHALL generate new access token
2. WHEN a client sends valid refresh token, THEN THE System SHALL generate new refresh token
3. WHEN a client sends expired refresh token, THEN THE System SHALL reject the request and require re-login
4. WHEN a client sends invalid refresh token, THEN THE System SHALL reject the request and return error
5. WHEN generating new tokens, THEN THE System SHALL verify the user still exists in database
6. WHEN generating new tokens, THEN THE System SHALL return both new access token and new refresh token

### Requirement 5: User Logout

**User Story:** As a logged-in user, I want to logout from my account, so that my session is terminated securely.

#### Acceptance Criteria

1. WHEN a user initiates logout, THEN THE Client SHALL remove access token from local storage
2. WHEN a user initiates logout, THEN THE Client SHALL remove refresh token from local storage
3. WHEN a user initiates logout, THEN THE Client SHALL remove user data from local storage
4. WHEN a user initiates logout, THEN THE Client SHALL redirect to login page
5. WHEN logout is complete, THEN THE System SHALL clear authentication state in frontend

### Requirement 6: Protected Routes

**User Story:** As a system administrator, I want certain API endpoints to be protected, so that only authenticated users can access them.

#### Acceptance Criteria

1. WHEN a request is made to protected endpoint, THEN THE System SHALL verify access token in Authorization header
2. WHEN access token is valid, THEN THE System SHALL attach user information to request object
3. WHEN access token is valid, THEN THE System SHALL allow request to proceed to route handler
4. WHEN access token is missing, THEN THE System SHALL return 401 Unauthorized error
5. WHEN access token is invalid, THEN THE System SHALL return 401 Unauthorized error
6. WHEN access token is expired, THEN THE System SHALL return 401 Unauthorized error with specific expired message
7. WHERE Authorization header format is "Bearer <token>", THEN THE System SHALL extract token correctly

### Requirement 7: Password Security

**User Story:** As a user, I want my password to be stored securely, so that my account cannot be compromised if the database is breached.

#### Acceptance Criteria

1. WHEN storing password, THEN THE System SHALL hash password using bcrypt with salt rounds of 10
2. WHEN storing password, THEN THE System SHALL never store plain text password in database
3. WHEN querying user data, THEN THE System SHALL exclude password field by default
4. WHEN authenticating user, THEN THE System SHALL use bcrypt compare to verify password
5. WHEN returning user data in API response, THEN THE System SHALL never include password field

### Requirement 8: Input Validation

**User Story:** As a system administrator, I want all user inputs to be validated, so that the system is protected from malicious data.

#### Acceptance Criteria

1. WHEN validating email, THEN THE System SHALL check email matches regex pattern for valid email format
2. WHEN validating username, THEN THE System SHALL trim whitespace from beginning and end
3. WHEN validating email, THEN THE System SHALL convert email to lowercase
4. WHEN validating email, THEN THE System SHALL trim whitespace from beginning and end
5. WHEN validation fails, THEN THE System SHALL return 400 Bad Request with descriptive error message
6. WHEN validation fails, THEN THE System SHALL include field name in error message
7. WHEN multiple validations fail, THEN THE System SHALL return all validation errors in response

### Requirement 9: Error Handling

**User Story:** As a developer, I want consistent error responses, so that the frontend can handle errors appropriately.

#### Acceptance Criteria

1. WHEN an error occurs, THEN THE System SHALL return JSON response with error field
2. WHEN validation error occurs, THEN THE System SHALL return 400 status code
3. WHEN authentication error occurs, THEN THE System SHALL return 401 status code
4. WHEN resource not found error occurs, THEN THE System SHALL return 404 status code
5. WHEN duplicate key error occurs, THEN THE System SHALL return 409 status code
6. WHEN server error occurs, THEN THE System SHALL return 500 status code
7. WHEN returning error, THEN THE System SHALL include descriptive error message
8. WHEN returning error, THEN THE System SHALL not expose sensitive system information

### Requirement 10: Frontend Integration

**User Story:** As a frontend developer, I want clear API contracts, so that I can integrate authentication seamlessly.

#### Acceptance Criteria

1. WHEN user logs in successfully, THEN THE Client SHALL store access token in localStorage
2. WHEN user logs in successfully, THEN THE Client SHALL store refresh token in localStorage
3. WHEN user logs in successfully, THEN THE Client SHALL store user data in localStorage
4. WHEN making API requests, THEN THE Client SHALL include access token in Authorization header
5. WHEN access token expires, THEN THE Client SHALL automatically call refresh token endpoint
6. WHEN refresh token expires, THEN THE Client SHALL redirect user to login page
7. WHEN user data is needed, THEN THE Client SHALL retrieve from AuthContext
8. WHEN authentication state changes, THEN THE Client SHALL update AuthContext

### Requirement 11: Google OAuth Authentication

**User Story:** As a user, I want to login with my Google account, so that I can access the application without creating a new password.

#### Acceptance Criteria

1. WHEN a user clicks "Login with Google" button, THEN THE System SHALL redirect to Google OAuth consent screen
2. WHEN Google OAuth returns authorization code, THEN THE System SHALL exchange code for user profile information
3. WHEN receiving Google profile, THEN THE System SHALL check if user exists by googleId
4. WHEN user with googleId exists, THEN THE System SHALL authenticate user and return tokens
5. WHEN user with googleId does not exist but email exists, THEN THE System SHALL link Google account to existing user
6. WHEN user with googleId and email do not exist, THEN THE System SHALL create new user with Google profile data
7. WHEN creating user from Google profile, THEN THE System SHALL set provider field to "google"
8. WHEN creating user from Google profile, THEN THE System SHALL set googleId field
9. WHEN creating user from Google profile, THEN THE System SHALL NOT require password field
10. WHEN creating user from Google profile, THEN THE System SHALL use Google profile picture as avatar
11. WHEN creating user from Google profile, THEN THE System SHALL derive username from Google name or email
