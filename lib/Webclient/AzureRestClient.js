"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const WebClient_1 = require("./WebClient");
class ApiResult {
    constructor(error, result, request, response) {
        this.error = error;
        this.result = result;
        this.request = request;
        this.response = response;
    }
}
exports.ApiResult = ApiResult;
class AzureError {
}
exports.AzureError = AzureError;
function ToError(response) {
    let error = new AzureError();
    error.statusCode = response.statusCode;
    error.message = response.body;
    if (response.body && response.body.error) {
        error.code = response.body.error.code;
        error.message = response.body.error.message;
        error.details = response.body.error.details;
        console.log(`##[error] ${error.message}`);
    }
    return error;
}
exports.ToError = ToError;
class AzureRestClient extends WebClient_1.WebClient {
    constructor(authorizer, options) {
        super(options);
        this._authorizer = authorizer;
    }
    getRequestUri(uriFormat, parameters, queryParameters, apiVersion) {
        return this.getRequestUriForbaseUrl(this._authorizer.getResourceManagerUrl(), uriFormat, parameters, queryParameters, apiVersion);
    }
    getRequestUriForbaseUrl(baseUrl, uriFormat, parameters, queryParameters, apiVersion) {
        let requestUri = baseUrl + uriFormat;
        requestUri = requestUri.replace('{subscriptionId}', encodeURIComponent(this._authorizer.getActiveSubscription()));
        for (let key in parameters) {
            requestUri = requestUri.replace(key, encodeURIComponent(parameters[key]));
        }
        // trim all duplicate forward slashes in the url
        var regex = /([^:]\/)\/+/gi;
        requestUri = requestUri.replace(regex, '$1');
        // process query paramerters
        queryParameters = queryParameters || [];
        if (!!apiVersion) {
            queryParameters.push('api-version=' + encodeURIComponent(apiVersion));
        }
        if (queryParameters.length > 0) {
            requestUri += '?' + queryParameters.join('&');
        }
        return requestUri;
    }
    beginRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let token = yield this._authorizer.getToken();
            request.headers = request.headers || {};
            request.headers['Authorization'] = `Bearer ${token}`;
            request.headers['Content-Type'] = 'application/json; charset=utf-8';
            let httpResponse = yield this.sendRequest(request);
            if (httpResponse.statusCode === 401 && httpResponse.body && httpResponse.body.error && httpResponse.body.error.code === "ExpiredAuthenticationToken") {
                // The access token might have expired. Re-issue the request after refreshing the token.
                token = yield this._authorizer.getToken(true);
                request.headers['Authorization'] = `Bearer ${token}`;
                httpResponse = yield this.sendRequest(request);
            }
            return httpResponse;
        });
    }
    accumulateResultFromPagedResult(nextLinkUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = [];
            while (!!nextLinkUrl) {
                let nextRequest = {
                    method: 'GET',
                    uri: nextLinkUrl
                };
                let response = yield this.beginRequest(nextRequest);
                if (response && response.statusCode == 200 && response.body) {
                    if (response.body.value) {
                        result = result.concat(response.body.value);
                    }
                    nextLinkUrl = response.body.nextLink;
                }
                else {
                    // forcing the compiler to assume that response will be not null or undefined
                    return new ApiResult(ToError(response));
                }
            }
            return new ApiResult(null, result);
        });
    }
}
exports.default = AzureRestClient;