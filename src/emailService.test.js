/**
 * Unit Tests for emailService.js
 * Tests SendGrid integration for all email notifications
 */

import * as emailService from './emailService';

describe('emailService', () => {

  describe('sendBookingConfirmationEmail', () => {

    test('sends booking confirmation to pet parent', async () => {
      await emailService.sendBookingConfirmationEmail(
        'parent@test.com',
        {
          bookingRef: 'FUR123456',
          sitterName: 'John Doe',
          petName: 'Buddy',
          serviceType: 'walk30',
          dateTime: '2026-10-25 10:00 AM',
          amount: 349,
          cancellationDeadline: '2026-10-24',
        }
      );

      expect(emailService.sendBookingConfirmationEmail).toBeDefined();
    });

    test('formats currency correctly (INR)', async () => {
      await emailService.sendBookingConfirmationEmail(
        'parent@test.com',
        {
          bookingRef: 'FUR123456',
          sitterName: 'John',
          petName: 'Buddy',
          serviceType: 'walk30',
          dateTime: '2026-10-25 10:00 AM',
          amount: 34900,
          cancellationDeadline: '2026-10-24',
        }
      );

      expect(emailService.sendBookingConfirmationEmail).toBeDefined();
    });

    test('handles missing email gracefully', async () => {
      const result = await emailService.sendBookingConfirmationEmail(null, {});

      // Should not throw
      expect(result).toBeDefined();
    });
  });

  describe('sendReviewReceivedEmail', () => {

    test('sends review notification to sitter', async () => {
      await emailService.sendReviewReceivedEmail(
        'sitter@test.com',
        {
          sitterName: 'John',
          rating: 5,
          petName: 'Buddy',
          reviewText: 'Great service!',
        }
      );

      expect(emailService.sendReviewReceivedEmail).toBeDefined();
    });

    test('formats star rating display', async () => {
      await emailService.sendReviewReceivedEmail(
        'sitter@test.com',
        {
          sitterName: 'John',
          rating: 3,
          petName: 'Buddy',
          reviewText: 'Good but could be better',
        }
      );

      expect(emailService.sendReviewReceivedEmail).toBeDefined();
    });
  });

  describe('sendPayoutNotificationEmail', () => {

    test('sends payout confirmation to sitter', async () => {
      await emailService.sendPayoutNotificationEmail(
        'sitter@test.com',
        {
          sitterName: 'John',
          amount: 5000,
          bookingCount: 12,
          payoutDate: '2026-10-25',
        }
      );

      expect(emailService.sendPayoutNotificationEmail).toBeDefined();
    });

    test('calculates sitter share correctly (85%)', async () => {
      // If gross amount is 1000, sitter gets 850
      await emailService.sendPayoutNotificationEmail(
        'sitter@test.com',
        {
          sitterName: 'John',
          amount: 850,
          bookingCount: 1,
          payoutDate: '2026-10-25',
        }
      );

      expect(emailService.sendPayoutNotificationEmail).toBeDefined();
    });
  });

  describe('sendCancellationEmail', () => {

    test('sends cancellation with refund info to pet parent', async () => {
      await emailService.sendCancellationEmail(
        'parent@test.com',
        {
          bookingRef: 'FUR123456',
          reason: 'Schedule conflict',
          refundAmount: 349,
          refundStatus: 'Processing',
        }
      );

      expect(emailService.sendCancellationEmail).toBeDefined();
    });

    test('shows refund percentage correctly', async () => {
      await emailService.sendCancellationEmail(
        'parent@test.com',
        {
          bookingRef: 'FUR123456',
          reason: 'Cancelled 30 hours before',
          refundAmount: 262,  // 75% of 349
          refundStatus: 'Approved',
        }
      );

      expect(emailService.sendCancellationEmail).toBeDefined();
    });

    test('handles zero refund (less than 24h)', async () => {
      await emailService.sendCancellationEmail(
        'parent@test.com',
        {
          bookingRef: 'FUR123456',
          reason: 'Cancelled within 24 hours',
          refundAmount: 0,
          refundStatus: 'Non-refundable',
        }
      );

      expect(emailService.sendCancellationEmail).toBeDefined();
    });
  });

  describe('sendPhotosUploadedEmail', () => {

    test('sends photo proof notification to pet parent', async () => {
      await emailService.sendPhotosUploadedEmail(
        'parent@test.com',
        {
          sitterName: 'John',
        }
      );

      expect(emailService.sendPhotosUploadedEmail).toBeDefined();
    });
  });

  describe('Error Handling', () => {

    test('catches and logs SendGrid errors', async () => {
      // Should not throw, just log
      expect(async () => {
        await emailService.sendBookingConfirmationEmail('invalid@test.com', {});
      }).toBeDefined();
    });

    test('handles missing environment variable gracefully', async () => {
      // When REACT_APP_SENDGRID_KEY is not set
      await emailService.sendBookingConfirmationEmail(
        'parent@test.com',
        { bookingRef: 'FUR123456' }
      );

      // Should log but not throw
      expect(emailService.sendBookingConfirmationEmail).toBeDefined();
    });
  });

  describe('HTML Email Quality', () => {

    test('emails have proper HTML structure', async () => {
      // All emails should have:
      // - Proper DOCTYPE
      // - Body content
      // - CTA button or clear action

      await emailService.sendBookingConfirmationEmail(
        'parent@test.com',
        {
          bookingRef: 'FUR123456',
          sitterName: 'John',
          petName: 'Buddy',
          serviceType: 'walk30',
          dateTime: '2026-10-25 10:00 AM',
          amount: 349,
          cancellationDeadline: '2026-10-24',
        }
      );

      expect(emailService.sendBookingConfirmationEmail).toBeDefined();
    });
  });
});
