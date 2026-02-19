import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Run } from './api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusColor(status: Run['status']) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500 hover:bg-green-600 border-transparent text-white';
    case 'FAILED':
      return 'bg-red-500 hover:bg-red-600 border-transparent text-white';
    case 'PROCESSING':
      return 'bg-blue-500 hover:bg-blue-600 border-transparent text-white';
    default:
      return 'bg-gray-500 hover:bg-gray-600 border-transparent text-white';
  }
}
