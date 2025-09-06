import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders SynergySphere app', () => {
  render(<App />);
  // Test that the app renders without crashing
  expect(document.querySelector('.App')).toBeInTheDocument();
});
