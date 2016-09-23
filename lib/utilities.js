'use strict';

var Request = require('./request');
var assign = require('object-assign');
var Bluebird = require('bluebird');
var PAGINATION_LINKS = ['first', 'previous', 'next', 'last'];

/**
 * Utilities
 *
 * @namespace
 * @name utilities
 */
module.exports = {
  requestFun: requestFun,
  requestWithDataFun: requestWithDataFun,
  requestWithFileFun: requestWithFileFun,

  paginationFilter: paginationFilter,
  getPaginationHandler: getPaginationHandler
};

function dataFilter(options, response) {
  return response.data;
}

/**
 * gets a handler that fetches the paginated page
 * 
 * @param {string} Url of the pagination link
 * @param {function} authFlow 
 * @param {ojbect} headers to pass in the request.
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 */
function getPaginationHandler(url, authFlow, headers, responseFilter) {
  var request = {
    method: 'GET',
    responseType: 'json',
    url: url,
    headers: getRequestHeaders(headers)
  };

  var settings = {
    maxRetries: 1,
    authFlow: authFlow,
  };

  if (typeof settings.authFlow === 'function') {
    settings.authFlow = authFlow();
  }

  var options = {
    headers: headers,
    authFlow: authFlow,
    responseFilter: responseFilter || paginationFilter
  };

  return function() {
    return Request.create(request, settings)
    .send()
    .then(options.responseFilter.bind(null, options));
  };
}

/**
 * gets methods to handle pagination
 * @param {object} options
 * @param {object} the service response
 * @returns pagination object with items, total and methods to call next, previous, last, first.
 */
function paginationFilter(options, response) {
  var headers = response.headers || {};
  var page = {
    items: response.data || []
  };
  page.total = page.items.length;

  if (headers.hasOwnProperty('mendeley-count')) {
    page.total = parseInt(headers['mendeley-count'], 10);
  }

  page.headers = {
    link: {},
    accept: options.headers['Accept']
  };

  if (headers.link) {
    PAGINATION_LINKS.forEach(function (name) {
      if (!headers.link[name]) {
        return
      }

      page[name] = getPaginationHandler(headers.link[name], options.authFlow, options.headers, options.responseFilter);
      page.headers.link[name] = headers.link[name];

    });


  }

  return page;
}

function normaliseOptions(options) {
  options.responseFilter = options.responseFilter || dataFilter;
  options.args = options.args || [];
  options.headers = options.headers || {};

  return options;
}

/**
 * A general purpose request functions
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} method
 * @param {string} uriTemplate
 * @param {array} uriVars
 * @param {array} headers
 * @returns {function}
 */
function requestFun(options) {
  options = normaliseOptions(options);

  return function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var url = getUrl(options, args);
    var params = args[options.args.length];

    var request = {
      method: options.method,
      responseType: 'json',
      url: url,
      headers: getRequestHeaders(options.headers),
      params: params
    };

    var settings = {
      authFlow: options.authFlow()
    };

    if (options.method === 'GET') {
      settings.maxRetries = 1;
    }

    return Request.create(request, settings)
      .send()
      .then(options.responseFilter.bind(null, options));
  };
}

/**
 * Get a request function that sends data i.e. for POST, PUT, PATCH
 * The data will be taken from the calling argument after any uriVar arguments.
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} method - The HTTP method
 * @param {string} uriTemplate - A URI template e.g. /documents/{id}
 * @param {array} uriVars - The variables for the URI template in the order
 * they will be passed to the function e.g. ['id']
 * @param {object} headers - Any additional headers to send
 *  e.g. { 'Content-Type': 'application/vnd.mendeley-documents+1.json'}
 * @param {bool} followLocation - follow the returned location header? Default is false
 * @returns {function}
 */
function requestWithDataFun(options) {
  options = normaliseOptions(options);

  return function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var url = getUrl(options, args);
    var data = args[options.args.length];
    var request = {
      method: options.method,
      url: url,
      headers: getRequestHeaders(options.headers, data),
      data: JSON.stringify(data)
    };

    var settings = {
      authFlow: options.authFlow(),
      followLocation: options.followLocation
    };

    return Request.create(request, settings)
      .send()
      .then(options.responseFilter.bind(null, options));
  };
}

/**
 * Get a request function that sends a file
 *
 * @private
 * @param {function} [responseFilter] - Optional filter to control which part of the response the promise resolves with
 * @param {string} method
 * @param {string} uriTemplate
 * @param {string} linkType - Type of the element to link this file to
 * @param {object} headers - Any additional headers to send
 * @returns {function}
 */
function requestWithFileFun(options) {
  options = normaliseOptions(options);

  return function () {
    var args = Array.prototype.slice.call(arguments, 0);
    var url = getUrl(options, args);
    var file = args[0];
    var linkId = args[1];
    var requestHeaders = assign({}, getRequestHeaders(uploadHeaders(options, file, linkId), options.method), options.headers);
    var progressHandler;

    if (typeof args[args.length - 1] === 'function') {
      progressHandler = args[args.length - 1];
    }

    var request = {
      method: options.method,
      url: url,
      headers: requestHeaders,
      data: file,
      progress: progressHandler
    };

    var settings = {
      authFlow: options.authFlow()
    };

    return Request.create(request, settings)
      .send()
      .then(options.responseFilter.bind(null, options));
  };
}

/**
 * Provide the correct encoding for UTF-8 Content-Disposition header value.
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
 *
 * @private
 * @param {string} str
 * @returns {string}
 */
function encodeRFC5987ValueChars(str) {
  return encodeURIComponent(str).
    replace(/'/g, '%27').
    replace(/\(/g, '%28').
    replace(/\)/g, '%29').
    replace(/\*/g, '%2A');
}

/**
 * Get headers for an upload
 *
 * @private
 * @param {object} file
 * @param {string} [file.type='application/octet-stream'] Value for the Content-Type header
 * @param {string} file.name File name e.g. 'foo.pdf'
 * @param {string} linkId
 * @param {string} linkType either 'group' or 'document'
 * @returns {object}
 */
function uploadHeaders(options, file, linkId) {
  var headers = {
    'Content-Type': !!file.type ? file.type : 'application/octet-stream',
    'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + encodeRFC5987ValueChars(file.name)
  };
  if (options.linkType && linkId) {
    var baseUrl = options.baseUrl(options.method, options.resource, options.headers);

    switch (options.linkType) {
      case 'group':
        headers.Link = '<' + baseUrl + '/groups/' + linkId + '>; rel="group"';
        break;
      case 'document':
        headers.Link = '<' + baseUrl + '/documents/' + linkId + '>; rel="document"';
        break;
    }
  }

  return headers;
}

/**
 * Generate a URL from a template with properties and values
 *
 * @private
 * @param {string} uriTemplate
 * @param {array} uriProps
 * @param {array} uriValues
 * @returns {string}
 */
function getUrl(options, args) {
  var baseUrl = options.baseUrl(options.method, options.resource, options.headers);

  if (!options.args.length) {
    return baseUrl + options.resource;
  }

  var uriParams = {};

  options.args.forEach(function (prop, index) {
    uriParams[prop] = args[index];
  });

  return baseUrl + expandUriTemplate(options.resource, uriParams);
}

/**
 * Get the headers for a request
 *
 * @private
 * @param {array} headers
 * @param {array} data
 * @returns {array}
 */
function getRequestHeaders(headers, data) {
  for (var headerName in headers) {
    var val = headers[headerName];
    if (typeof val === 'function') {
      headers[headerName] = val(data);
    }
  }

  return headers;
}

/**
 * Populate a URI template with data
 *
 * @private
 * @param {string} template
 * @param {object} data
 * @returns {string}
 */
function expandUriTemplate(template, data) {
  var matches = template.match(/\{[a-z]+\}/gi);
  matches.forEach(function (match) {
    var prop = match.replace(/[\{\}]/g, '');
    if (!data.hasOwnProperty(prop)) {
      throw new Error('Endpoint requires ' + prop);
    }
    template = template.replace(match, data[prop]);
  });

  return template;
}
