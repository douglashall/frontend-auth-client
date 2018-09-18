import Cookies from 'universal-cookie';

import applyMockAuthInterface from './mockAuthInterface';
import axiosConfig from '../axiosConfig';
import getAuthenticatedAPIClient from '../index';

const authConfig = {
  appBaseUrl: process.env.BASE_URL,
  authServiceUrl: process.env.AUTH_SERVICE_URL,
  accessTokenCookieName: process.env.ACCESS_TOKEN_COOKIE_NAME,
  csrfCookieName: process.env.CSRF_COOKIE_NAME,
};

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const jwt = {
  email: 'test@example.com',
  preferred_username: 'test',
};
const expiredJwt = Object.assign({exp: yesterday.getTime() / 1000}, jwt);
const encodedExpiredJwt = `header.${btoa(JSON.stringify(expiredJwt))}`;
const validJwt = Object.assign({exp: tomorrow.getTime() / 1000}, jwt);
const encodedValidJwt = `header.${btoa(JSON.stringify(validJwt))}`;

const mockCookies = {
  get: jest.fn(),
};
jest.genMockFromModule('universal-cookie');
Cookies.mockImplementation(() => mockCookies);
jest.mock('universal-cookie');

function expectLogoutToHaveBeenCalled(client) {
  expect(client.logout).toHaveBeenCalled();
}

function expectLogoutToNotHaveBeenCalled(client) {
  expect(client.logout).not.toHaveBeenCalled();
}

function expectRefreshAccessTokenToHaveBeenCalled(client) {
  expect(client.refreshAccessToken).toHaveBeenCalled();
}

function expectRefreshAccessTokenToNotHaveBeenCalled(client) {
  expect(client.refreshAccessToken).not.toHaveBeenCalled();
}

function testRequestInterceptorFulfillment(isAuthUrl, isAccessTokenExpired, isRefreshingToken, rejectRefreshAccessToken, expects) {
  it(`${expects.name} when isAuthUrl=${isAuthUrl} isAccessTokenExpired=${isAccessTokenExpired}`, () => {
    const client = getAuthenticatedAPIClient(authConfig);
    applyMockAuthInterface(client, rejectRefreshAccessToken);
    client.isAuthUrl.mockReturnValue(isAuthUrl);
    client.isAccessTokenExpired.mockReturnValue(isAccessTokenExpired);
    axiosConfig.__Rewire__('isRefreshingToken', isRefreshingToken);
    const fulfilledResult = client.interceptors.request.handlers[0].fulfilled({});
    expects(client);

    if (rejectRefreshAccessToken) {
      fulfilledResult.catch(() => {
        expect(client.logout).toHaveBeenCalled();
      });
    }
  });
}

function testResponseInterceptorRejection(error, expects) {
  it(`${expects.name} when error=${error}`, () => {
    const client = getAuthenticatedAPIClient(authConfig);
    applyMockAuthInterface(client);
    client.interceptors.response.handlers[0].rejected(error)
      .catch(() => {
        expects(client);
      });
  });
}

describe('getAuthenticatedAPIClient', () => {
  it('returns a singleton', () => {
    const client1 = getAuthenticatedAPIClient(authConfig);
    const client2 = getAuthenticatedAPIClient(authConfig);
    expect(client2).toBe(client1);
  });
});

describe('AuthenticatedAPIClient auth interface', () => {
  const client = getAuthenticatedAPIClient(authConfig);

  it('has method getAuthenticationState that returns authentication state when valid JWT cookie exists', () => {
    mockCookies.get.mockReturnValueOnce(encodedValidJwt);
    const result = client.getAuthenticationState();
    expect(result.authentication.email).toEqual(validJwt.email);
    expect(result.authentication.username).toEqual(validJwt.preferred_username);
  });

  it('has method getAuthenticationState that returns empty state when no JWT cookie exists', () => {
    const result = client.getAuthenticationState();
    expect(result.authentication).toBeUndefined();
  });

  it('has method isAuthenticated', () => {
    expect(client.isAuthenticated()).toBe(false);
    mockCookies.get.mockReturnValueOnce(encodedValidJwt);
    expect(client.isAuthenticated()).toBe(true);
  });

  it('has method isAccessTokenExpired', () => {
    mockCookies.get.mockReturnValueOnce(encodedValidJwt);
    expect(client.isAccessTokenExpired()).toBe(false);
    mockCookies.get.mockReturnValueOnce(encodedExpiredJwt);
    expect(client.isAccessTokenExpired()).toBe(true);
  });

  it('has method login', () => {
    [process.env.BASE_URL, undefined].forEach((redirectUrl) => {
      window.location.assign = jest.fn();
      client.login(redirectUrl);
      expect(window.location.assign).toHaveBeenCalledWith(
        `${process.env.AUTH_SERVICE_URL}/login?next=${encodeURIComponent(process.env.BASE_URL)}`
      );
    });
  });

  it('has method logout', () => {
    [process.env.BASE_URL, undefined].forEach((redirectUrl) => {
      window.location.assign = jest.fn();
      client.logout(redirectUrl);
      expect(window.location.assign).toHaveBeenCalledWith(
        `${process.env.AUTH_SERVICE_URL}/logout?redirect_url=${encodeURIComponent(process.env.BASE_URL)}`
      );
    });
  });

  it('has method refreshAccessToken', () => {
    client.post = jest.fn();

    client.post.mockReturnValueOnce(new Promise((resolve) => resolve()));
    client.refreshAccessToken();
    expect(client.post).toHaveBeenCalled();

    client.post.mockReturnValueOnce(new Promise((resolve, reject) => reject()));
    client.refreshAccessToken()
      .catch((error) => {
        expect(error.message).toEqual('Failed to refresh access token.');
      });
  });

  it('has method isAuthUrl', () => {
    expect(
      client.isAuthUrl(`${process.env.AUTH_SERVICE_URL}/user_api/v1/account/refresh_access_token/`)
    ).toBe(true);
    expect(client.isAuthUrl(`${process.env.AUTH_SERVICE_URL}/test/`)).toBe(false);
  });
});

describe('AuthenticatedAPIClient request interceptor', () => {
  [
    [true, true, false, false, expectRefreshAccessTokenToNotHaveBeenCalled],
    [true, false, false, false, expectRefreshAccessTokenToNotHaveBeenCalled],
    [false, true, false, false, expectRefreshAccessTokenToHaveBeenCalled],
    [false, true, false, true, expectRefreshAccessTokenToHaveBeenCalled],
    [false, true, true, false, expectRefreshAccessTokenToNotHaveBeenCalled],
    [false, false, false, false, expectRefreshAccessTokenToNotHaveBeenCalled],
  ].forEach((mockValues) => {
    testRequestInterceptorFulfillment(...mockValues);
  });

  it('returns error if it is rejected', () => {
    const client = getAuthenticatedAPIClient(authConfig);
    const error = new Error('It failed!');
    client.interceptors.request.handlers[0].rejected(error)
      .catch((rejection) => {
        expect(rejection).toBe(error);
      });
  });
});

describe('AuthenticatedAPIClient response interceptor', () => {
  [
    [{response: {status: 401}}, expectLogoutToHaveBeenCalled],
    [{response: {}}, expectLogoutToNotHaveBeenCalled],
    [{}, expectLogoutToNotHaveBeenCalled],
    [null, expectLogoutToNotHaveBeenCalled],
  ].forEach((mockValues) => {
    testResponseInterceptorRejection(...mockValues);
  });

  it('returns response if it is fulfilled', () => {
    const client = getAuthenticatedAPIClient(authConfig);
    const response = {data: 'It worked!'};
    const result = client.interceptors.response.handlers[0].fulfilled(response);
    expect(result).toBe(response);
  });
});
