import { faker } from '@faker-js/faker';

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  ssn: string;
  employmentStatus: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  password: string;
}

export function generateSignupData(): SignupData {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    firstName,
    lastName,
    email: faker.internet.email({ firstName, lastName }),
    phone: faker.phone.number({ style: 'national' }),
    ssn: faker.string.numeric(9),
    employmentStatus: 'Employed',
    street: faker.location.streetAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip: faker.location.zipCode('#####'),
    password: `${faker.internet.password({ length: 10, memorable: false })}Aa1!`,
  };
}
