# Lessons Learned & Design Decisions for the Picolabs 2026 Capstone Project

This document details our group's experience working on the Manifold Chatbot interface over the Winter 2026 semester. It should reveal some of the critical decisions, successes, compromises, and challenges we encountered in the development.

## What was harder than expected?

Building out the API Wrappers was a challenge due to the fact that multiple layers of code was necessary for our team to write more-or-less from scratch. The endpoints were easy to identify through the picolab engine and browser network monitoring, but fulfulling the correct requirements for post requests and bridging the gap between the chatbot's natural language and the API's raw data was the main hurdle of our project.

Building the backend primarily in JavaScript was also a challenge, as debugging it was not a straightforward process. For example, the Manifold Assistant bot we built could not give exact error logs, only a vague message about technical difficulties. This required the use of a separate MCP Inspector to diagnose primary function issues, and without advanced debugging tools our team had to rely on triggering manual errors to view detailed information (simple console logs were not an option with the detailed console output).

Finally, working with the Manifold Assistant to ensure accurate information delivery was frustrating due to its issues with data hallucination. We were not able to achieve local testing with the chatbot until very late into development, meaning anyone who wished to test it must use the master server instance. This naturally resulted in hundreds of similar calls all being stored in the bot's context, which after repeated attempts of creating, editing, and deleting similar picos, began to negatively influence its accuracy. Flushing its context and especially local testing could fix the context issue.

## Key architectural decisions and the tradeoffs considered (e.g., why MCP over direct API calls, why stdio over HTTP for the MCP server)

We used the Model Context Protocol when designing our chatbot to limit its responses down to the strict capabilities and functions as defined in our documents. Direct API calls enacted by the bot could easily result in more errors caused by hallucination, but also makes our application less flexible with new functions or skills.

For the transport layer, we chose stdio over HTTP. This decision prioritized security and local simplicity and by using standard input/output, we eliminated the need to expose network ports or manage complex authentication for a web-based endpoint.

## What would our team do differently if we had an opportunity to start the project over?

Following a suggestion that we received from the Capstone Presentation, a great place to expand our project idea would have been structuring it around a more portable infrastructure. Rather than our current project needing to build new API wrappers for every potential use case (i.e. expanding it beyond the scope of just the Pico Engine), we could have a system that generates the necessary docs and functions based off of a provided set of API calls. This way, we could easily use our chatbot to slot into various other services and be more useful in a real-world setting to various industries.

## What didn’t get done?

We had a few planned goals for our project that we weren't able to finish due to time constraints. First, our main goal that we had to abandon was the possibility of our chatbot installing new skills to expand its abilities beyond the manifold interface. This was the biggest disappointment of our work and what we would love to prioritize if given more time. 

Other dropped features include the ability to have multiple pico Things and Communities use the same name, an easy visual button to reset our chatbot's context, and detailed logging with every step of our code's progress for easier debugging.

## What the most important open problems or limitations are. This tells someone coming in where they should start for the highest payoff improvements. 

By far the biggest limitations of our project are the limited code applicability (it only working with the pico engine, and requiring unique API Wrappers created from scratch for unique applications) and the hallucinations & errors caused by our Manifold Assistant. With stricter MCP rules or prompt training, the generative AI could easily improve, it just needs additional work to be ironed out.