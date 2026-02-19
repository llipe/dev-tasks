---
applyTo: "**"
---
# Rule: Document Product Context

## Goal

To guide an AI assistant in documenting the general context and macro view of the product or project. This establishes a foundational understanding of what the product is, its purpose, target users, and strategic goals.

## Process

1. **Receive Product Brief:** The user provides initial information about the product or project.
2. **Ask Clarifying Questions:** Before finalizing the document, ask strategic questions to understand the complete picture.
3. **Generate Product Context Document:** Create a comprehensive overview using the structure outlined below.
4. **Save Output:** Save the document as `product-context.md` in the `/docs` directory of the working repository.

## Clarifying Questions

Adapt questions based on the context provided, but explore these key areas:

- **Product Definition:** "What is this product/project, and what does it do?"
- **Problem Statement:** "What core problem does this product solve?"
- **Target Users/Market:** "Who are the primary users or target audience?"
- **Strategic Goals:** "What are the 3-5 key strategic objectives for this product?"
- **Success Metrics:** "How do we measure the success of this product?"
- **Competitive Landscape:** "Are there competing solutions? What makes this product different?"
- **Current State:** "Does this product already exist? If so, what is its current state (MVP, mature, etc.)?"
- **Vision/Roadmap:** "What is the long-term vision for this product? Are there planned phases or milestones?"
- **Key Constraints:** "Are there any budget, timeline, technology, or regulatory constraints?"
- **Stakeholders:** "Who are the key stakeholders or decision-makers?"

## Output Structure

The generated Product Context document should include:

1. **Executive Summary:** A brief (2-3 sentence) overview of the product and its primary purpose.
2. **Problem Statement:** What specific problem(s) does this product solve?
3. **Target Users/Market:** Who are the primary users and secondary users? Any market segments?
4. **Strategic Goals:** The 3-5 key objectives the product should achieve.
5. **Current State:** Is this a new product, MVP, or mature product? What stage is it in?
6. **Vision & Roadmap:** Long-term vision for the product and any planned phases.
7. **Success Metrics:** How success will be measured (e.g., user adoption, revenue, engagement).
8. **Competitive Landscape:** Existing competitors or similar solutions and differentiation points.
9. **Key Constraints:** Budget, timeline, technology, regulatory, or other constraints.
10. **Key Stakeholders:** Major decision-makers and their interests.
11. **Assumptions:** Any major assumptions underlying the product strategy.
12. **Open Questions:** Remaining questions or areas needing clarification.

## Target Audience

The primary audience is the **product team and developers**. The document should be clear enough for someone new to the project to understand the "why" behind the product.

## Output

- **Format:** Markdown (`.md`)
- **Location:** `/docs/` (in the working repository)
- **Filename:** `product-context.md`

## Final Instructions

1. Do NOT start implementing anything
2. Ask the user clarifying questions to fill in gaps
3. Use their answers to refine and improve the Product Context document
4. Save the finalized document and present it to the user for review
