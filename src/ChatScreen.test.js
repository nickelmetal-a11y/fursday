/**
 * Unit tests for ChatScreen.js — the sitter <-> pet parent messaging screen.
 * Covers both directions of the interaction: a sitter talking to a parent,
 * and a parent talking to a sitter.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ChatScreen from './ChatScreen';

let insertedRows;
let realtimeHandler;
let notifyMessageReceivedMock;

jest.mock('./notificationService', () => ({
  notifyMessageReceived: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./supabase', () => {
  const messagesTable = {
    select: () => messagesTable,
    eq: () => messagesTable,
    order: () => Promise.resolve({ data: global.__mockMessages || [] }),
    insert: (row) => {
      global.__insertedRows.push(row);
      return Promise.resolve({ data: row, error: null });
    },
  };
  const channel = {
    on: (_event, _config, handler) => {
      global.__realtimeHandler = handler;
      return channel;
    },
    subscribe: () => channel,
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'me-123' } } }),
      },
      from: () => messagesTable,
      channel: () => channel,
      removeChannel: () => {},
    },
  };
});

const booking = {
  id: 'booking-1',
  service: 'Walk 30 min',
  sitterName: 'Priya',
  parentName: 'Rahul',
  sitter_id: 'sitter-9',
  pet_parent_id: 'parent-9',
  otherPhone: '9876543210',
};

beforeEach(() => {
  global.__mockMessages = [];
  global.__insertedRows = [];
  global.__realtimeHandler = null;
  insertedRows = global.__insertedRows;
  notifyMessageReceivedMock = require('./notificationService').notifyMessageReceived;
  notifyMessageReceivedMock.mockClear();
});

describe('ChatScreen - sitter <-> parent interaction', () => {

  test('shows a loading state, then an empty state when there are no messages', async () => {
    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    expect(screen.getByText(/Loading messages/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/No messages yet/i)).toBeInTheDocument());
  });

  test('parent view: header shows the sitter\'s name', async () => {
    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Priya')).toBeInTheDocument());
  });

  test('sitter view: header shows the parent\'s name', async () => {
    render(<ChatScreen booking={booking} userType="sitter" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Rahul')).toBeInTheDocument());
  });

  test('quick replies differ for sitter vs parent', async () => {
    const { unmount } = render(<ChatScreen booking={booking} userType="sitter" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('On my way!')).toBeInTheDocument());
    unmount();

    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText('Thank you!')).toBeInTheDocument());
  });

  test('renders existing messages from both sides, aligned by sender', async () => {
    global.__mockMessages = [
      { id: 'm1', sender_id: 'me-123', sender_type: 'parent', message: 'Hi Priya!', created_at: new Date().toISOString() },
      { id: 'm2', sender_id: 'sitter-9', sender_type: 'sitter', message: 'On my way!', created_at: new Date().toISOString() },
    ];
    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Hi Priya!')).toBeInTheDocument();
      expect(screen.getByText('On my way!')).toBeInTheDocument();
    });
  });

  test('parent sends a message: inserted with sender_type "parent" and notifies the sitter', async () => {
    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => screen.getByPlaceholderText(/Type a message/i));

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: 'What time will you arrive?' } });
    fireEvent.click(screen.getByRole('button', { name: '' })); // send icon button has no accessible name

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0]).toMatchObject({
      booking_id: 'booking-1',
      sender_id: 'me-123',
      sender_type: 'parent',
      message: 'What time will you arrive?',
    });
    await waitFor(() => expect(notifyMessageReceivedMock).toHaveBeenCalledWith('sitter-9', null, 'Rahul'));
  });

  test('sitter sends a message: inserted with sender_type "sitter" and notifies the parent', async () => {
    render(<ChatScreen booking={booking} userType="sitter" onBack={() => {}} />);
    await waitFor(() => screen.getByPlaceholderText(/Type a message/i));

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: 'On my way now' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Type a message/i), { key: 'Enter' });

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0]).toMatchObject({
      sender_type: 'sitter',
      message: 'On my way now',
    });
    await waitFor(() => expect(notifyMessageReceivedMock).toHaveBeenCalledWith('parent-9', null, 'Priya'));
  });

  test('a quick reply fills the input instead of sending immediately', async () => {
    render(<ChatScreen booking={booking} userType="sitter" onBack={() => {}} />);
    await waitFor(() => screen.getByText('On my way!'));

    fireEvent.click(screen.getByText('On my way!'));
    expect(screen.getByPlaceholderText(/Type a message/i).value).toBe('On my way!');
    expect(insertedRows).toHaveLength(0); // filling the box must not auto-send
  });

  test('blank or whitespace-only input is never sent', async () => {
    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => screen.getByPlaceholderText(/Type a message/i));

    fireEvent.change(screen.getByPlaceholderText(/Type a message/i), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Type a message/i), { key: 'Enter' });

    await new Promise((r) => setTimeout(r, 0));
    expect(insertedRows).toHaveLength(0);
  });

  test('a new message arriving over realtime is appended live', async () => {
    render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No messages yet/i)).toBeInTheDocument());

    expect(global.__realtimeHandler).toBeInstanceOf(Function);
    act(() => {
      global.__realtimeHandler({
        new: { id: 'm9', sender_id: 'sitter-9', sender_type: 'sitter', message: 'Gate is open', created_at: new Date().toISOString() },
      });
    });

    await waitFor(() => expect(screen.getByText('Gate is open')).toBeInTheDocument());
  });

  test('no booking (no booking.id) renders without crashing and skips loading', async () => {
    render(<ChatScreen booking={null} userType="parent" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/No messages yet/i)).toBeInTheDocument());
  });

  test('phone button only renders when a phone number is available', async () => {
    render(<ChatScreen booking={{ ...booking, otherPhone: '' }} userType="parent" onBack={() => {}} />);
    await waitFor(() => screen.getByText('Priya'));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    const { container } = render(<ChatScreen booking={booking} userType="parent" onBack={() => {}} />);
    await waitFor(() => expect(container.querySelector('a[href="tel:9876543210"]')).toBeInTheDocument());
  });

  test('back button calls onBack', async () => {
    const onBack = jest.fn();
    const { container } = render(<ChatScreen booking={booking} userType="parent" onBack={onBack} />);
    await waitFor(() => screen.getByText('Priya'));
    fireEvent.click(container.querySelector('svg.lucide-arrow-left').closest('div'));
    expect(onBack).toHaveBeenCalled();
  });
});
