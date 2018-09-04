import axios from 'axios';
import Cookies from 'universal-cookie';
import jwtDecode from 'jwt-decode';

const cookies = new Cookies();
const accessTokenCookieName = process.env.ACCESS_TOKEN_COOKIE_NAME;
const authServiceUrl = process.env.AUTH_SERVICE_URL;
const loginUrl = `${authServiceUrl}/login/`;
const logoutUrl = `${authServiceUrl}/logout/`;
const refreshAccessTokenEndpoint = `${authServiceUrl}/user_api/v1/account/refresh_access_token/`;

class AuthClient {
  static authUrls = [
    refreshAccessTokenEndpoint,
  ];

  static isAuthenticated() {
    return !!cookies.get(accessTokenCookieName);
  }

  static isAccessTokenExpired() {
    try {
      let token = jwtDecode(cookies.get(accessTokenCookieName));
      if (token.exp < Date.now() / 1000) {
        return true;
      }
    } catch(error) {}
    return false;
  }

  static login(redirectUrl) {
    window.location = `${loginUrl}?next=${encodeURIComponent(redirectUrl)}`;
  }

  static logout(redirectUrl) {
    window.location = `${logoutUrl}?redirect_url=${encodeURIComponent(redirectUrl)}`;
  }

  static refreshAccessToken() {
    return axios.post(refreshAccessTokenEndpoint)
      .catch(error => {
        return new Promise((resolve, reject) => {
          reject(new Error('Failed to refresh access token.'));
        });
      });
  }
}

export default AuthClient;
