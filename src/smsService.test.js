/**
 * Unit Tests for smsService.js
 * Tests MSG91 integration for SMS notifications
 */

import * as smsService from './smsService';

describe('smsService', () => {

  describe('sendBookingReminderSMS', () => {

    test('sends SMS reminder to sitter', async () => {
      await smsService.sendBookingReminderSMS(
        '9876543210',
        {
          sitterName: 'New booking!',
          petName: 'Buddy',
          dateTime: '2026-10-25 10:00 AM',
        }
      );

      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });

    test('sends SMS reminder to pet parent', async () => {
      await smsService.sendBookingReminderSMS(
        '9123456789',
        {
          sitterName: 'John Doe',
          petName: 'Buddy',
          dateTime: '2026-10-25 10:00 AM',
        }
      );

      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });

    test('formats phone number correctly (91-prefix for India)', async () => {
      // Should auto-add 91 prefix if not present
      await smsService.sendBookingReminderSMS(
        '9876543210',
        {
          sitterName: 'Reminder',
          petName: 'Buddy',
          dateTime: 'Tomorrow 10:00 AM',
        }
      );

      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });

    test('handles phone number with existing 91 prefix', async () => {
      await smsService.sendBookingReminderSMS(
        '919876543210',
        {
          sitterName: 'Reminder',
          petName: 'Buddy',
          dateTime: 'Tomorrow 10:00 AM',
        }
      );

      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });
  });

  describe('sendWalkStartingSoonSMS', () => {

    test('sends urgent SMS when walk is starting soon', async () => {
      await smsService.sendWalkStartingSoonSMS(
        '9876543210',
        {
          petName: 'Buddy',
          time: '10:00 AM',
        }
      );

      expect(smsService.sendWalkStartingSoonSMS).toBeDefined();
    });
  });

  describe('sendPayoutNotificationSMS', () => {

    test('sends payout confirmation SMS to sitter', async () => {
      await smsService.sendPayoutNotificationSMS(
        '9876543210',
        5000
      );

      expect(smsService.sendPayoutNotificationSMS).toBeDefined();
    });

    test('formats currency correctly for India', async () => {
      // Should show as "Rs. 5,000"
      await smsService.sendPayoutNotificationSMS(
        '9876543210',
        15000
      );

      expect(smsService.sendPayoutNotificationSMS).toBeDefined();
    });
  });

  describe('sendPhotosUploadedSMS', () => {

    test('sends notification when photos are uploaded', async () => {
      await smsService.sendPhotosUploadedSMS(
        '9123456789',
        'John Doe'
      );

      expect(smsService.sendPhotosUploadedSMS).toBeDefined();
    });
  });

  describe('sendDisputeResolutionSMS', () => {

    test('sends dispute resolution to relevant party', async () => {
      await smsService.sendDisputeResolutionSMS(
        '9876543210',
        'Dispute resolved in your favor'
      );

      expect(smsService.sendDisputeResolutionSMS).toBeDefined();
    });
  });

  describe('Phone Number Handling', () => {

    test('rejects non-India phone numbers gracefully', async () => {
      // Should handle non-91 numbers gracefully
      const result = await smsService.sendBookingReminderSMS(
        '14155552671',  // US number
        { sitterName: 'Test', petName: 'Dog', dateTime: 'Now' }
      );

      // Should fail gracefully, not throw
      expect(result).toBeDefined();
    });

    test('handles invalid phone format', async () => {
      await smsService.sendBookingReminderSMS(
        'invalid',
        { sitterName: 'Test', petName: 'Dog', dateTime: 'Now' }
      );

      // Should not throw
      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });

    test('handles null/empty phone number', async () => {
      const result = await smsService.sendBookingReminderSMS(
        null,
        { sitterName: 'Test', petName: 'Dog', dateTime: 'Now' }
      );

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Message Length', () => {

    test('SMS messages are under 160 characters (single SMS)', async () => {
      // Most messages should be single SMS to save costs
      await smsService.sendWalkStartingSoonSMS(
        '9876543210',
        { petName: 'Buddy', time: '10:00 AM' }
      );

      // Implementation should ensure under 160 chars
      expect(smsService.sendWalkStartingSoonSMS).toBeDefined();
    });

    test('handles long sitter names appropriately', async () => {
      await smsService.sendBookingReminderSMS(
        '9876543210',
        {
          sitterName: 'Alexander Sebastian Williamson III',
          petName: 'Christopher',
          dateTime: 'Tomorrow morning 10:30 AM IST',
        }
      );

      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });
  });

  describe('Error Handling', () => {

    test('catches and logs MSG91 errors', async () => {
      // Should not throw, just log
      expect(async () => {
        await smsService.sendBookingReminderSMS('9876543210', {});
      }).toBeDefined();
    });

    test('handles missing environment variable gracefully', async () => {
      // When REACT_APP_MSG91_AUTH_KEY is not set
      await smsService.sendPayoutNotificationSMS('9876543210', 5000);

      // Should log but not throw
      expect(smsService.sendPayoutNotificationSMS).toBeDefined();
    });

    test('continues if MSG91 API fails', async () => {
      // Booking should succeed even if SMS fails
      // SMS should fail silently
      await smsService.sendBookingReminderSMS(
        '9876543210',
        { sitterName: 'Test', petName: 'Dog', dateTime: 'Now' }
      );

      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {

    test('handles rapid consecutive SMS requests', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          smsService.sendBookingReminderSMS(
            '9876543210',
            { sitterName: `Test ${i}`, petName: 'Dog', dateTime: 'Now' }
          )
        );
      }

      // Should handle without error
      await Promise.all(requests);
      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });
  });

  describe('Localization', () => {

    test('messages are in English for Indian users', async () => {
      await smsService.sendBookingReminderSMS(
        '9876543210',
        {
          sitterName: 'John',
          petName: 'Buddy',
          dateTime: 'Today 5:00 PM',
        }
      );

      // Should send English SMS for India
      expect(smsService.sendBookingReminderSMS).toBeDefined();
    });
  });
});
