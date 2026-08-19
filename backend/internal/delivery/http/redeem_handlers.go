package http

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"natcon2026/backend/internal/domain"
)

// The desk that hands over pins and goodiebags. One endpoint, one scan, one
// item — the door crew's app switches which item it is asking for.

func redeemDTO(res *domain.RedeemResult) map[string]any {
	return map[string]any{
		"member_id":   res.MemberID,
		"name":        res.Name,
		"member_code": res.MemberCode,
		"chapter":     res.Chapter,
		"company":     res.Company,
		"visits":      res.Visits,
		"redeemed_at": res.RedeemedAt.In(eventZone).Format(time.RFC3339),
	}
}

func (s *Server) handleRedeem(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MemberCode string `json:"member_code"`
		Item       string `json:"item"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondDecodeError(w, err, "invalid data format")
		return
	}
	res, err := s.admin.RedeemItem(r.Context(), req.MemberCode, req.Item)
	if err != nil {
		// A second scan is not an error the crew should have to interpret:
		// it comes back with the person and the time it was collected.
		if errors.Is(err, domain.ErrAlreadyRedeemed) && res != nil {
			body := redeemDTO(res)
			body["error"] = err.Error()
			body["already"] = true
			respondJSON(w, http.StatusConflict, body)
			return
		}
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, redeemDTO(res))
}

func (s *Server) handleRedeemCounts(w http.ResponseWriter, r *http.Request) {
	tally, err := s.admin.RedeemCounts(r.Context())
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, map[string]any{
		"pins":       tally.Pins,
		"goodiebags": tally.Goodiebags,
		"members":    tally.Members,
	})
}
