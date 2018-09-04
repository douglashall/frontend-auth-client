import axios from 'axios';

import AuthClient from './AuthClient';

let isRefreshingToken = false;
let refreshTokenSubscribers = [];

function publishTokenRefresh() {
  refreshTokenSubscribers = refreshTokenSubscribers.filter(cb => {
    cb();
    return false;
  });
}s

function subscribeTokenRefresh(cb) {
  refreshTokenSubscribers.push(cb);
}

//**** Axios request interceptors ****

axios.interceptors.request.use((config) => {
  let originalRequest = config;
  let isAuthUrl = AuthClient.authUrls.includes(originalRequest.url);
  if (!isAuthUrl && AuthClient.isAccessTokenExpired()) {
    if (!isRefreshingToken) {
      isRefreshingToken = true;
      AuthClient.refreshAccessToken()
        .then(() => {
          isRefreshingToken = false;
          publishTokenRefresh();
        })
        .catch(() => {
          store.dispatch(logout());
        });
    }

    return new Promise((resolve) => {
      subscribeTokenRefresh(() => {
        resolve(originalRequest);
      });
    });
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export {
  AuthClient
};
