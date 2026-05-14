-- AlterEnum: add CLIENT_PASSWORD_RESET purpose for OTP-based password reset flow
ALTER TYPE "OtpPurpose" ADD VALUE 'CLIENT_PASSWORD_RESET';
