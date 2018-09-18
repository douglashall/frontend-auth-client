let isRefreshingToken = false;
let refreshTokenSubscribers = [];

// Apply default configuration options to the Axios HTTP client.
function applyAxiosDefaults(authenticatedAPIClient) {
  /* eslint-disable no-param-reassign */
  authenticatedAPIClient.defaults.withCredentials = true;
  authenticatedAPIClient.defaults.xsrfHeaderName = 'X-CSRFToken';
  authenticatedAPIClient.defaults.xsrfCookieName = authenticatedAPIClient.csrfCookieName;
  /* eslint-enable no-param-reassign */
}

// Apply auth-related interceptors to the Axios HTTP Client.
function applyAxiosInterceptors(authenticatedAPIClient) {
  /**
   * publishTokenRefresh and subscribeTokenRefresh are used to queue
   * API requests during the refresh token process, so that we do not
   * attempt to make simultaneous requests to refresh the access token.
   */
  function publishTokenRefresh() {
    refreshTokenSubscribers = refreshTokenSubscribers.filter((cb) => {
      cb();
      return false;
    });
  }

  function subscribeTokenRefresh(cb) {
    refreshTokenSubscribers.push(cb);
  }

  /**
   * Ensure the browser has an unexpired JWT cookie before making API requests.
   * 
   * This will attempt to refresh the JWT cookie if a valid refresh token cookie exists.
   */
  function ensureValidJWTCookie(request) {
    const originalRequest = request;
    const isAuthUrl = authenticatedAPIClient.isAuthUrl(originalRequest.url);
    const isAccessTokenExpired = authenticatedAPIClient.isAccessTokenExpired();
    if (!isAuthUrl && isAccessTokenExpired) {
      if (!isRefreshingToken) {
        isRefreshingToken = true;
        authenticatedAPIClient.refreshAccessToken()
          .then(() => {
            isRefreshingToken = false;
            publishTokenRefresh();
          })
          .catch(() => {
            authenticatedAPIClient.logout();
          });
      }

      return new Promise((resolve) => {
        subscribeTokenRefresh(() => {
          resolve(originalRequest);
        });
      });
    }
    return request;
  }

  // Redirect to the logout page if an unauthorized API response was received.
  function handleUnauthorizedAPIResponse(error) {
    const errorStatus = error && error.response && error.response.status;
    if (errorStatus === 401 || errorStatus === 403) {
      authenticatedAPIClient.logout(authenticatedAPIClient.appBaseUrl);
    }
    return Promise.reject(error);
  }

  // Apply Axios interceptors
  authenticatedAPIClient.interceptors.request.use(
    ensureValidJWTCookie,
    error => Promise.reject(error)
  );
  authenticatedAPIClient.interceptors.response.use(
    response => response,
    handleUnauthorizedAPIResponse
  );
}

export {
  applyAxiosDefaults,
  applyAxiosInterceptors,
};
