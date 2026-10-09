import packageJson from '../../package.json'

/** Canonical application version for runtime code. package.json is the source of truth. */
export const APP_VERSION = packageJson.version
