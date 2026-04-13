.PHONY: collect dev frontend schedule clean help

help:           ## Show this help
	@awk 'BEGIN{FS":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-10s\033[0m %s\n",$$1,$$2}' $(MAKEFILE_LIST)

collect:        ## Run the collector once
	cd collector && uv run python main.py

dev: collect    ## Seed data then start the frontend
	cd frontend && npm run dev

schedule:       ## Run the collector daemon (refreshes daily at 07:00 NZST)
	cd collector && uv run python scheduler.py

frontend:       ## Frontend only, no collector
	cd frontend && npm run dev

clean:          ## Remove generated snapshot
	rm -f frontend/public/data/snapshot.json
