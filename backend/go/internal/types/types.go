package types

const (
	EntityTypeRun = "RUN"
	StatusPending = "PENDING"
)

type RunRequestBody struct {
	Query    string `json:"query"`
	Location string `json:"location,omitempty"`
}

type RunItem struct {
	ID         string `dynamodbav:"id" json:"id"`
	EntityType string `dynamodbav:"entityType" json:"entityType"`
	Query      string `dynamodbav:"query" json:"query"`
	Location   string `dynamodbav:"location,omitempty" json:"location,omitempty"`
	Status     string `dynamodbav:"status" json:"status"`
	CreatedAt  string `dynamodbav:"createdAt" json:"createdAt"`
	LeadsCount int    `dynamodbav:"leadsCount,omitempty" json:"leadsCount,omitempty"`
}

type LeadItem struct {
	ID          string `dynamodbav:"id" json:"id"`
	RunID       string `dynamodbav:"runId" json:"runId"`
	CompanyName string `dynamodbav:"companyName" json:"companyName"`
	Domain      string `dynamodbav:"domain" json:"domain"`
	Description string `dynamodbav:"description" json:"description"`
	Status      string `dynamodbav:"status" json:"status"`
	Source      string `dynamodbav:"source" json:"source"`
	CreatedAt   string `dynamodbav:"createdAt" json:"createdAt"`
	Summary     string `dynamodbav:"summary,omitempty" json:"summary,omitempty"`
	EmailDraft  string `dynamodbav:"email_draft,omitempty" json:"email_draft,omitempty"`
}
