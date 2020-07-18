'use strict'

class OctopusEnergy {
  static #BASE_URL = 'https://api.octopus.energy';

  #accountNumber = null;
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
  async getAccountNumber() {
    if (!this.#accountNumber) {
      await this.#GQLgetLoggedInUser();
    }
    return this.#accountNumber;
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
      'query': 'mutation apiKeyAuthentication($apiKey: String!) {apiKeyAuthentication(apiKey: $apiKey) {token __typename } }'
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

  #GQLgetLoggedInUser = async function() {
    if (!this.isAuthenticated()) {
      throw 'Authentication required';
    }
    let payload = {
      'operationName': 'getLoggedInUser',
      'variables': {},
      'query': 'query getLoggedInUser { viewer { accounts { number __typename } preferredName __typename } }'
    }
    let json = await this.#submitGQL(payload);
    // TODO: handle multiple account numbers (right now we only handle the first one)
    this.#accountNumber = json.viewer.accounts[0].number;
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
