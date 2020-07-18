'use strict'

class OctopusEnergy {
  static #BASE_URL = 'https://api.octopus.energy';

  #accounts = [];
  #token = null;
  #preferredName = null;

  async authenticate() {
    if (arguments.length === 1) {
      await this.#authenticateWithApiKey(arguments[0]);
    } else if (arguments.length === 2) {
      await this.#authenticateWithEmailPassword(arguments[0], arguments[1]);
    } else {
      throw `authenticate() with ${arguments.length} arguments is undefined!`;
    }
  }

  async getProducts() {
    // TODO: implement pagination (this works for now because the default limit is 100)
    let response = await this.#getFromOctopus('/v1/products');
    let json = await response.json();
    return json.results;
  }

  async getProduct(productCode) {
    let response = await this.#getFromOctopus(`/v1/products/${productCode}/`);
    let json = await response.json();
    return json;
  }

  isAuthenticated() {
    return !!this.#token;
  }

  // BEGIN GETTERS
async getAccount(accountNumber) {
  let account = await this.#mustBeValidAccount(accountNumber);
  if (!account.status) {
    this.#GQLgetAccount(accountNumber);
  }
  return account;
}

  async getAccounts() {
    if (!this.#accounts.length) {
      await this.#GQLgetLoggedInUser();
    }
    return this.#accounts;
  }

  async getPreferredName() {
    if (!this.#preferredName) {
      await this.#GQLgetLoggedInUser();
    }
    return this.#preferredName;
  }

  // BEGIN PRIVATE METHODS

  #authenticateWithApiKey = async function(apiKey) {
    let payload = {
      'operationName': 'apiKeyAuthentication',
      'variables': { apiKey },
      'query': 'mutation apiKeyAuthentication($apiKey: String!) {apiKeyAuthentication(apiKey: $apiKey) {token } }'
    };
    let json = await this.#submitGQL(payload);
    this.#handleAuthentication(json.apiKeyAuthentication.token, `using API key <code>${apiKey}</code>`);
  }

  #authenticateWithEmailPassword = async function(email, password) {
    let payload = {
      'operationName': 'emailPasswordAuthentication',
      'variables': { email, password },
      'query': 'mutation emailPasswordAuthentication($email: String!, $password: String!) { emailAuthentication(email: $email, password: $password) { token } }'
    };
    let json = await this.#submitGQL(payload);
    this.#handleAuthentication(json.emailAuthentication.token, `using email address ${email} (and password)`);
  }

  #getFromOctopus = async function(url) {
    return await fetch(`${OctopusEnergy.#BASE_URL}${url}/`);
  }

  #GQLgetAccount = async function(accountNumber) {
    this.#mustBeAuthenticated();
    let account = await this.#mustBeValidAccount(accountNumber);
    let payload = {
      'operationName': 'getAccount',
      'variables': { 'accountNumber': 'A-6D321FD7' },
      'query': 'query getAccount($accountNumber: String!) { account(accountNumber: $accountNumber) { status number balance properties { id address occupancyPeriods { effectiveFrom effectiveTo } coordinates { latitude longitude } electricityMeterPoints { mpan id gspGroupId meters(includeInactive: false) { id serialNumber } agreements { id validFrom validTo tariff { __typename ... on TariffType { standingCharge displayName fullName __typename } ... on StandardTariff { unitRate __typename } ... on DayNightTariff { dayRate nightRate __typename } ... on HalfHourlyTariff { unitRates { value validFrom validTo __typename } } } } smartStartDate } gasMeterPoints { mprn id meters { id serialNumber } agreements { id validFrom validTo tariff { displayName fullName unitRate standingCharge } } smartStartDate } } } }'
    }
    let json = await this.#submitGQL(payload);
    console.log(json);
    account.status = json.account.status;
  }

  #GQLgetLoggedInUser = async function() {
    this.#mustBeAuthenticated();
    let payload = {
      'operationName': 'getLoggedInUser',
      'variables': {},
      'query': 'query getLoggedInUser { viewer { accounts { number } preferredName } }'
    }
    let json = await this.#submitGQL(payload);
    for (const account of json.viewer.accounts) {
      this.#accounts.push( { number: account.number } );
    }
    this.#preferredName = json.viewer.preferredName;
  }

  #handleAuthentication = function(token, message) {
    if (token) {
      this.#token = token;
      console.debug(`Successfully authenticated ${message}`);
      return;
    } else {
      throw `Unable to authenticate ${message}`;
    }
  }
  
  #mustBeAuthenticated = function() {
    if (!this.isAuthenticated()) {
      throw 'Authentication required';
    }
  }

  #mustBeValidAccount = async function(accountNumber) {
    let accounts = await this.getAccounts();
    for (const account of accounts) {
      if (account.number === accountNumber) {
        return account;
      }
    }
    throw `Invalid account number ${accountNumber}`;
  }

  #submitGQL = async function(payload) {
    const GQLURL = `${OctopusEnergy.#BASE_URL}/v1/graphql/`;
    console.debug(`Submitting payload to ${GQLURL}:`, payload);
    let headers = {
      'Content-Type': 'application/json'
    };
    if (this.isAuthenticated()) {
      headers.authorization = this.#token;
    }
    let response = await fetch(GQLURL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    let json = await response.json();
    console.debug('Response received from GQL:', json);
    return json.data;
  }
}
