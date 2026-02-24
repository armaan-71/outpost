package api

import (
	"errors"
	"log/slog"

	"github.com/aws/aws-lambda-go/events"
)

// GetUserID safely extracts the Clerk User ID from the API Gateway JWT authorizer context.
func GetUserID(request events.APIGatewayV2HTTPRequest) (string, error) {
	claim, ok := request.RequestContext.Authorizer.JWT.Claims["sub"]
	if !ok {
		slog.Warn("No sub claim found in authorizer context.")
		return "", errors.New("unauthorized")
	}

	if claim == "" {
		slog.Warn("Sub claim is empty.")
		return "", errors.New("invalid sub claim")
	}

	return claim, nil
}
