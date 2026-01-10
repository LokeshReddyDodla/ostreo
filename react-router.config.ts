import type { Config } from '@react-router/dev/config';

export default {
	appDirectory: './src/app',
	ssr: true,
	prerender: false, // Disable prerendering to avoid build hangs
} satisfies Config;
