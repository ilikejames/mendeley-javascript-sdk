'use strict';

describe('utilities', function () {
    var utils = require('../../../lib/utilities');
    var Request = require('../../../lib/request');
    var mockAuth = require('../../mocks/auth');
    var assign = require('object-assign');
    var Bluebird = require('bluebird');
    var authFlow = mockAuth.mockImplicitGrantFlow();
    var requestCreateSpy;

    var defaultOptions = {
        authFlow: function () {
            return authFlow;
        },
        baseUrl: function () {
            return 'https://api.mendeley.com';
        }
    };

    var responsePromise = Bluebird.resolve({
        headers: {
            Header: '123'
        },
        data: {
            id: '456'
        }
    });

    beforeEach(function () {
        requestCreateSpy = spyOn(Request, 'create').and.returnValue({
            send: function () {
                return responsePromise;
            }
        });
    });

    describe('requestFun', function () {

        it('should create a request with given properties', function () {
            var requestParameters = {
                param: 'This is a request parameter'
            };
            var requestFunction = utils.requestFun(assign({
                method: 'GET',
                resource: '/test',
                headers: {
                    Accept: 'mime/type1',
                    'Content-Type': 'mime/type2'
                }
            }, defaultOptions));

            requestFunction(requestParameters);

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'GET',
                responseType: 'json',
                url: 'https://api.mendeley.com/test',
                headers: {
                    Accept: 'mime/type1',
                    'Content-Type': 'mime/type2'
                },
                params: requestParameters
            }, {
                    authFlow: authFlow,
                    maxRetries: 1
                });
        });

        it('should construct the url from supplied pattern and arguments', function () {
            var requestFunction = utils.requestFun(assign({
                method: 'GET',
                resource: '/test/{first}/{second}',
                args: ['first', 'second']
            }, defaultOptions));

            requestFunction(1, 2);

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'GET',
                responseType: 'json',
                url: 'https://api.mendeley.com/test/1/2',
                headers: {},
                params: undefined
            }, {
                    authFlow: authFlow,
                    maxRetries: 1
                });
        });

        it('should filter data from the response by default', function (done) {
            var requestFunction = utils.requestFun(assign({
                method: 'GET',
                resource: '/test'
            }, defaultOptions));

            requestFunction().then(function (data) {
                expect(data.id).toBe('456');
                done();
            });
        });

        it('should allow properties to be filtered from the response using a responseFilter', function (done) {
            var requestFunction = utils.requestFun(assign({
                responseFilter: function (options, response) {
                    return response.headers;
                },
                method: 'GET',
                resource: '/test'
            }, defaultOptions));

            requestFunction().then(function (data) {
                expect(data.Header).toBe('123');
                done();
            });
        });

        it('should allow headers to be supplied as functions', function () {
            var requestFunction = utils.requestFun(assign({
                method: 'GET',
                resource: '/test',
                headers: {
                    Header: function () {
                        return 'footer';
                    }
                }
            }, defaultOptions));

            requestFunction();

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'GET',
                responseType: 'json',
                url: 'https://api.mendeley.com/test',
                headers: {
                    Header: 'footer'
                },
                params: undefined
            }, {
                    authFlow: authFlow,
                    maxRetries: 1
                });
        });

    });

    describe('requestWithDataFun', function () {

        it('should create a request with given properties', function () {
            var requestData = {
                id: '123'
            };
            var requestFunction = utils.requestWithDataFun(assign({
                method: 'POST',
                resource: '/test',
                headers: {
                    Accept: 'mime/type1',
                    'Content-Type': 'mime/type2'
                },
                followLocation: true
            }, defaultOptions));

            requestFunction(requestData);

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://api.mendeley.com/test',
                headers: {
                    Accept: 'mime/type1',
                    'Content-Type': 'mime/type2'
                },
                data: JSON.stringify(requestData)
            }, {
                    authFlow: authFlow,
                    followLocation: true
                });
        });

        it('should construct the url from supplied pattern and arguments', function () {
            var requestFunction = utils.requestWithDataFun(assign({
                method: 'POST',
                resource: '/test/{first}/{second}',
                args: ['first', 'second']
            }, defaultOptions));

            requestFunction(1, 2);

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://api.mendeley.com/test/1/2',
                headers: {},
                data: undefined
            }, {
                    authFlow: authFlow,
                    followLocation: undefined
                });
        });

        it('should allow properties to be filtered from the response using a responseFilter', function (done) {
            var requestFunction = utils.requestWithDataFun(assign({
                responseFilter: function (options, response) {
                    return response.headers;
                },
                method: 'POST',
                resource: '/test'
            }, defaultOptions));

            requestFunction().then(function (data) {
                expect(data.Header).toBe('123');
                done();
            });
        });

    });

    describe('requestWithFileFun', function () {

        var file = {
            type: 'mime/type',
            name: 'file.type'
        };

        var headers = {
            'Content-Type': 'mime/type',
            'Content-Disposition': 'attachment; filename*=UTF-8\'\'file.type'
        };

        it('should create a request with given properties', function () {
            var requestFunction = utils.requestWithFileFun(assign({
                method: 'POST',
                resource: '/test'
            }, defaultOptions));

            requestFunction(file);

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://api.mendeley.com/test',
                headers: headers,
                data: file,
                progress: undefined
            }, {
                    authFlow: authFlow
                });
        });

        it('should allow properties to be filtered from the response using a responseFilter', function (done) {
            var requestFunction = utils.requestWithFileFun(assign({
                responseFilter: function (options, response) {
                    return response.headers;
                },
                method: 'POST',
                resource: '/test'
            }, defaultOptions));

            requestFunction(file).then(function (data) {
                expect(data.Header).toBe('123');
                done();
            });
        });

        it('should allow a progress handler to be passed as the last argment', function () {
            var progressHandler = function () { };
            var requestFunction = utils.requestWithFileFun(assign({
                method: 'POST',
                resource: '/test'
            }, defaultOptions));

            requestFunction(file, progressHandler);

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://api.mendeley.com/test',
                headers: headers,
                data: file,
                progress: progressHandler
            }, {
                    authFlow: authFlow
                });
        });

        it('should set Link header when necessary', function () {
            var requestFunction = utils.requestWithFileFun(assign({
                method: 'POST',
                resource: '/test',
                linkType: 'document'
            }, defaultOptions));

            requestFunction(file, 'zelda');

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'POST',
                url: 'https://api.mendeley.com/test',
                headers: assign({
                    Link: '<https://api.mendeley.com/documents/zelda>; rel="document"'
                }, headers),
                data: file,
                progress: undefined
            }, {
                    authFlow: authFlow
                });
        });

    });

    describe('paginationFilter', function () {

        var apiReponse = {
            headers: {
                link: {
                    next: 'http://i.am.the.next.link',
                    previous: 'http://i.am.the.previous.link',
                    dontdo:'something'
                },
                'mendeley-count': 199
            },
            data: [
                { id: 1 }
            ]
        };

        var options = {
            authFlow: function() { return authFlow; },
            baseUrl: 'baseUrl',
            method: 'GET',
            resource: '/communities/v1',
            headers: {
                'Accept': 'application/my/custom/mimetype',
                'Development-Token': 'devToken'
            },
            responseFilter : function() {}
        };

        it('should return the correct pagination object with next/prev methods', function () {

            var paginationResponse = utils.paginationFilter(options, apiReponse);

            expect(paginationResponse.total).toBe(199);
            expect(paginationResponse.items).toEqual([
                { id: 1 }
            ]);
            expect(paginationResponse.next).toBeDefined();
            expect(paginationResponse.previous).toBeDefined();
            expect(paginationResponse.first).not.toBeDefined();
            expect(paginationResponse.last).not.toBeDefined();
            expect(paginationResponse.dontdo).not.toBeDefined();

            expect(paginationResponse.headers).toEqual({
                accept:'application/my/custom/mimetype',
                link: {
                    next: 'http://i.am.the.next.link',
                    previous: 'http://i.am.the.previous.link'
                }
            });

        });

        it('next link should call the correct endpoint', function () {

            var paginationResponse = utils.paginationFilter(options, apiReponse);
            paginationResponse.next();

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'GET',
                url: 'http://i.am.the.next.link',
                headers: {
                    Accept: 'application/my/custom/mimetype',
                    'Development-Token': 'devToken'
                },
                responseType: 'json'
            }, {
                    authFlow: authFlow,
                    maxRetries: 1
                });
        });

    });

    describe('getPaginationHandler', function () {

        it('should return a method that calls the correct endpoint', function () {
            
            var handler = utils.getPaginationHandler('http://mylink?page=2', authFlow, {
                'Accept' : 'application/custom',
                'Development-Token' : 'devToken'
            });

            handler();

            expect(requestCreateSpy).toHaveBeenCalledWith({
                method: 'GET',
                url: 'http://mylink?page=2',
                headers: {
                    Accept: 'application/custom',
                    'Development-Token': 'devToken'
                },
                responseType: 'json'
            }, {
                    authFlow: authFlow,
                    maxRetries: 1
                });
        
        });
    });
});
