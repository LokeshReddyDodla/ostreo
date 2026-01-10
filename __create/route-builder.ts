import { Hono } from 'hono';
import type { Handler } from 'hono/types';
import updatedFetch from '../src/__create/fetch';

const API_BASENAME = '/api';
const api = new Hono();

if (globalThis.fetch) {
  globalThis.fetch = updatedFetch;
}

// Use Vite's glob import to statically import all route files
const routeModules = import.meta.glob('../src/app/api/**/route.js', {
  eager: !import.meta.env.DEV,
});

// Get route files from glob imports
async function getRouteFiles(): Promise<Array<{ path: string; module: any }>> {
  const routes: Array<{ path: string; module: any }> = [];
  
  for (const [path, moduleOrLoader] of Object.entries(routeModules)) {
    try {
      const module = import.meta.env.DEV 
        ? await (moduleOrLoader as () => Promise<any>)()
        : moduleOrLoader;
      routes.push({ path, module });
    } catch (error) {
      console.error(`Error loading route ${path}:`, error);
    }
  }
  
  // Sort by path length (longer paths first for more specific routes)
  return routes.sort((a, b) => b.path.length - a.path.length);
}

// Helper function to transform file path to Hono route path
function getHonoPath(globPath: string): { name: string; pattern: string }[] {
  // Extract path from glob pattern: ../src/app/api/auth/token/route.js -> auth/token
  const match = globPath.match(/\/api\/(.+)\/route\.js$/);
  if (!match || !match[1]) {
    return [{ name: 'root', pattern: '' }];
  }
  
  const routePath = match[1];
  const parts = routePath.split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return [{ name: 'root', pattern: '' }];
  }
  
  const transformedParts = parts.map((segment) => {
    const paramMatch = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (paramMatch) {
      const [_, dots, param] = paramMatch;
      return dots === '...'
        ? { name: param, pattern: `:${param}{.+}` }
        : { name: param, pattern: `:${param}` };
    }
    return { name: segment, pattern: segment };
  });
  return transformedParts;
}

// Import and register all routes
async function registerRoutes() {
  const routeFiles = await getRouteFiles().catch((error) => {
    console.error('Error finding route files:', error);
    return [];
  });

  // Clear existing routes
  api.routes = [];

  for (const { path, module } of routeFiles) {
    try {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      for (const method of methods) {
        try {
          if (module[method]) {
            const parts = getHonoPath(path);
            const honoPath = `/${parts.map(({ pattern }) => pattern).join('/')}`;
            const handler: Handler = async (c) => {
              const params = c.req.param();
              return await module[method](c.req.raw, { params });
            };
            const methodLowercase = method.toLowerCase();
            switch (methodLowercase) {
              case 'get':
                api.get(honoPath, handler);
                break;
              case 'post':
                api.post(honoPath, handler);
                break;
              case 'put':
                api.put(honoPath, handler);
                break;
              case 'delete':
                api.delete(honoPath, handler);
                break;
              case 'patch':
                api.patch(honoPath, handler);
                break;
              default:
                console.warn(`Unsupported method: ${method}`);
                break;
            }
          }
        } catch (error) {
          console.error(`Error registering route ${path} for method ${method}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error importing route file ${path}:`, error);
    }
  }
}

// Register routes at module load time
// This will execute during build, but routes will be available at runtime
registerRoutes().catch((error) => {
  // Silently fail during build - routes will be registered at runtime
  if (import.meta.env.DEV) {
    console.error('Failed to register routes:', error);
  }
});

export { api, API_BASENAME };
