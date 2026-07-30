package http

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "natcon_http_requests_total",
		Help: "Total HTTP requests by method and status code.",
	}, []string{"method", "code"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "natcon_http_request_duration_seconds",
		Help:    "HTTP request latency by method.",
		Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5},
	}, []string{"method"})
)

func metricsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/metrics" {
			next.ServeHTTP(w, r)
			return
		}
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		start := time.Now()
		next.ServeHTTP(ww, r)
		httpRequestsTotal.WithLabelValues(r.Method, strconv.Itoa(ww.Status())).Inc()
		httpRequestDuration.WithLabelValues(r.Method).Observe(time.Since(start).Seconds())
	})
}

func metricsHandler() http.Handler {
	return promhttp.Handler()
}
