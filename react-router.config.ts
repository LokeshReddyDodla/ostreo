import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	prerender: ['/'], // Prerender root route for static deployment
} satisfies Config;
