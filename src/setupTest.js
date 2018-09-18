import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

Enzyme.configure({ adapter: new Adapter() });

process.env.BASE_URL = 'http://example.com';
process.env.AUTH_SERVICE_URL = 'http://auth.example.com';
process.env.ACCESS_TOKEN_COOKIE_NAME = 'access-token-cookie-name';
process.env.CSRF_COOKIE_NAME = 'csrftoken';
