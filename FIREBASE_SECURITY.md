# Firebase Security Implementation Guide

## Current Issue
Your Firebase Realtime Database has insecure rules, which means anyone with your database URL can read from or write to your database.

## Solution
I've created a `database.rules.json` file with secure rules that require authentication. To implement these rules, you'll need to:

### 1. Set Up Firebase Authentication

Your project doesn't appear to use Firebase Authentication yet. Adding it is necessary to secure your database:

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to "Authentication" in the left sidebar
4. Click "Get started"
5. Enable at least one authentication method:
   - Email/Password is simplest for testing
   - Google, GitHub, or other OAuth providers for production

### 2. Upload Security Rules

1. In the Firebase Console, navigate to "Realtime Database"
2. Click on the "Rules" tab
3. Replace the current rules with the contents of the `database.rules.json` file
4. Click "Publish"

### 3. Update Your Application

You'll need to update your application to authenticate users. Add this to your Firebase service:

```typescript
// In src/services/firebase.ts
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';

// Initialize Firebase Auth
const auth = getAuth(app);

// Authentication state
export function subscribeAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Sign in with email/password
export async function signIn(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}
```

Then add a login page to your application.

### 4. For ESP32 Device Connection

Since your ESP32 device needs to connect to Firebase, you'll need to implement one of these approaches:

1. **Use Custom Tokens**: Generate a custom auth token in your backend that the ESP32 can use
2. **Use Service Account**: For IoT devices, you can use a service account with specific permissions
3. **Create Device-Specific Rules**: Add rules that allow specific devices to connect without auth

Example rule for IoT devices using an API key:
```json
{
  "rules": {
    "greenhouse": {
      "sensors": {
        ".write": "auth != null || request.auth.token.key === 'YOUR_ESP32_API_KEY'"
      }
    }
  }
}
```

### Testing Your Rules

After implementing authentication:
1. Log in with a test user
2. Verify data can be read/written
3. Log out and verify that data access is blocked

## Alternative Quick Fix

If you need a quick temporary fix while implementing authentication, you can restrict access by domain:

```json
{
  "rules": {
    ".read": "request.headers.referer.contains('yourdomain.com')",
    ".write": "request.headers.referer.contains('yourdomain.com')"
  }
}
```

Note: This is less secure than proper authentication but better than fully open access.