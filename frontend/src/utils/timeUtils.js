export const TIME_CONSTANTS = {
  START_TIME: '08:00',
  END_TIME: '22:00',
  INTERVAL_MINUTES: 30,
};

export function generateTimeSlots(start = TIME_CONSTANTS.START_TIME, end = TIME_CONSTANTS.END_TIME, intervalMinutes = TIME_CONSTANTS.INTERVAL_MINUTES) {
  const slots = [];
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    currentMinutes += intervalMinutes;
  }
  
  return slots;
}

export function validateTimeRange(startTime, endTime) {
  const errors = [];
  
  if (!startTime || !endTime) {
    errors.push('Start time and end time are required');
    return errors;
  }

  const start = startTime.trim();
  const end = endTime.trim();
  
  if (start < TIME_CONSTANTS.START_TIME) {
    errors.push(`Start time must be at or after ${TIME_CONSTANTS.START_TIME}`);
  }
  
  if (end > TIME_CONSTANTS.END_TIME) {
    errors.push(`End time must be at or before ${TIME_CONSTANTS.END_TIME}`);
  }
  
  if (end <= start) {
    errors.push('End time must be after start time');
  }
  
  return errors;
}

export function formatTimeDisplay(time) {
  if (!time) return '';
  return time.substring(0, 5);
}

export function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return '';
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  const durationMinutes = endMinutes - startMinutes;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    return `${hours}H ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}H`;
  } else {
    return `${minutes}m`;
  }
}

export function formatTimeWithDuration(startTime, endTime) {
  const formattedStart = formatTimeDisplay(startTime);
  const duration = calculateDuration(startTime, endTime);
  
  if (formattedStart && duration) {
    return `${formattedStart} - ${formatTimeDisplay(endTime)} (${duration})`;
  }
  return formattedStart || '';
}

export const TIME_SLOTS = generateTimeSlots();
