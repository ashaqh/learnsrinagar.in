export async function validate() {
    // API validation bypassed for local development
    return {
        isValid: true,
        message: 'API key validated successfully (bypassed for local development)'
    };
}