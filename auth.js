const keytar = require('keytar');
const crypto = require('crypto');

const SERVICE_NAME = 'agentic-browser';
const ACCOUNT_NAME = 'database-encryption';

class AuthManager {
    constructor() {
        this.isAuthenticated = false;
        this.derivedKey = null;
    }

    async isPasswordSet() {
        try {
            const password = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
            return password !== null;
        } catch (error) {
            console.error('[Auth] Error checking password:', error.message);
            return false;
        }
    }

    async setPassword(password) {
        // Validate password strength
        if (!this.validatePassword(password)) {
            throw new Error('Password must be at least 8 characters long');
        }

        try {
            // Store in system keychain
            await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, password);

            this.derivedKey = this.deriveKey(password);
            this.isAuthenticated = true;

            console.log('[Auth] Password set successfully');
            return { success: true, derivedKey: this.derivedKey };
        } catch (error) {
            console.error('[Auth] Error setting password:', error.message);
            throw error;
        }
    }

    async getStoredPassword() {
        try {
            return await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        } catch (error) {
            console.error('[Auth] Error getting stored password:', error.message);
            return null;
        }
    }

    async verifyPassword(password) {
        try {
            const storedPassword = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

            if (!storedPassword) {
                return { success: false, error: 'No password set' };
            }

            if (password === storedPassword) {
                this.derivedKey = this.deriveKey(password);
                this.isAuthenticated = true;
                console.log('[Auth] Password verified successfully');
                return { success: true, derivedKey: this.derivedKey };
            } else {
                return { success: false, error: 'Invalid password' };
            }
        } catch (error) {
            console.error('[Auth] Error verifying password:', error.message);
            return { success: false, error: error.message };
        }
    }

    validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return false;
        }
        return password.length >= 8;
    }

    deriveKey(password) {
        // Use PBKDF2 to derive a strong encryption key
        return crypto.pbkdf2Sync(
            password,
            'agentic-browser-salt-v1',  // Salt
            100000,                      // Iterations
            32,                          // Key length (256 bits)
            'sha256'                     // Hash algorithm
        ).toString('hex');
    }

    getDerivedKey() {
        if (!this.isAuthenticated || !this.derivedKey) {
            throw new Error('Not authenticated');
        }
        return this.derivedKey;
    }

    async resetPassword() {
        try {
            await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
            this.isAuthenticated = false;
            this.derivedKey = null;
            console.log('[Auth] Password reset');
            return { success: true };
        } catch (error) {
            console.error('[Auth] Error resetting password:', error.message);
            throw error;
        }
    }

    logout() {
        this.isAuthenticated = false;
        this.derivedKey = null;
        console.log('[Auth] Logged out');
    }
}

module.exports = AuthManager;
