// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=f2c75fe48c17';
export { CloudError } from './errors.js?v=f2c75fe48c17';
export { takeSignInReturn } from './sign-in-return.js?v=f2c75fe48c17';
