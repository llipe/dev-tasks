# User Login Flow

1. Client sends credentials to auth-service
2. auth-service validates against user-service
3. auth-service issues JWT
4. auth-service emits login event
5. notification-service sends login notification
