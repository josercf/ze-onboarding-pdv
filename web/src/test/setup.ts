import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';
if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = vi.fn(() => 'blob:teste');
if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = vi.fn();
