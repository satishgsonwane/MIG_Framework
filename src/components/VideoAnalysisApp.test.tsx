import React from 'react';
import { render, screen } from '@testing-library/react';
import VideoAnalysisApp from './VideoAnalysisApp';

test('hello world!', () => {
	render(<VideoAnalysisApp />);
	const linkElement = screen.getByText(/hello world/i);
	expect(linkElement).toBeInTheDocument();
});