import { createErrorResponse, ErrorCode } from '../utils/errorCodes.js';

const API_VERSION = '1.0.0';
const SUPPORTED_VERSIONS = ['1.0.0'];

export function versionMiddleware(req, res, next) {
  const versionHeader = req.headers['x-api-version'];
  const versionParam = req.query.version;
  
  const requestedVersion = versionHeader || versionParam || API_VERSION;
  
  if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
    return res.status(400).json(createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      `不支持的API版本: ${requestedVersion}，支持的版本: ${SUPPORTED_VERSIONS.join(', ')}`
    ));
  }
  
  req.apiVersion = requestedVersion;
  res.setHeader('X-API-Version', requestedVersion);
  res.setHeader('X-API-Latest-Version', API_VERSION);
  
  next();
}

export function getApiVersion() {
  return API_VERSION;
}

export function isVersionSupported(version) {
  return SUPPORTED_VERSIONS.includes(version);
}