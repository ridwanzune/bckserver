
# How The News Automation System Works (In Simple Terms)

This document explains the entire process of how the Dhaka Dispatch News Generator creates content, from start to finish, without using technical jargon.

Think of the whole process as an efficient, automated "shopping trip" to create 6 unique social media posts.

---

### Phase 1: The Bulk Shopping Trip (Gathering News)

Instead of making many small trips, the app does one big, efficient shopping run at the very beginning based on a specific list of topics.

1.  **Visiting Two Stores with a Precise List**: The app visits two different "news stores" (APITube.io and NewsAPI.org) with a specific shopping list for topics like "Bangladeshi Breaking News," "International Headlines," "Bangladeshi People in the News," and "Palestine News."
2.  **Getting Authentic Local News**: For the local Bangladesh topics, the app specifically asks for articles written in **Bengali**, ensuring it gets the most authentic, on-the-ground news. For international topics, it asks for English articles.
3.  **Creating a Giant Pool**: All these articles are put into one giant "shopping cart." The app is smart and automatically removes any duplicate articles.

This "bulk gathering" approach is very fast and ensures we have a high-quality, diverse selection of articles for the AI to choose from.

---

### Phase 1.5: The Universal Translator

Before the articles are sent to the editor, they go through a quick translation step. The app sends all the collected articles (especially the ones fetched in Bengali) to an AI translator. This ensures our expert editor receives all content in perfect English, allowing for a fair and consistent analysis across all news items.

---

### Phase 2: The Expert Editor (One Powerful AI Analysis)

Now, the app sends the entire shopping cart of translated articles to an expert AI editor (Google's Gemini model).

The AI has a clear set of instructions:
1.  **Review the entire pool** of articles.
2.  **Select the absolute best 6 stories** that perfectly match our required batch:
    -   **2** stories on **Bangladeshi Breaking News**.
    -   **2** stories on **International Headlines**.
    -   **1** story about a **notable Bangladeshi person or event**.
    -   **1** story about **Palestine**.
3.  **Analyze and Prepare All 6 at Once**: For each of the 6 articles it chooses, the AI simultaneously writes a new catchy headline, a social media caption, identifies the original source, and comes up with an idea for a symbolic image.
4.  **Return a Single, Organized Package**: The AI sends back all 6 completed analyses in a single, perfectly structured package.

This "analyze once" step is incredibly efficient and uses the AI's power to make the best possible selections from a wide range of options.

---

### Phase 3: The Assembly Line (Creating the Final Posts)

With the organized package from the AI, the app has everything it needs. For each of the 6 chosen articles, it now performs the final assembly steps in parallel:

1.  **Check the Original Image**: It tries to use the image that came with the original news article.
2.  **Call the Graphic Designer (If Needed)**: If the original image is missing or broken, it sends the AI's image idea to an AI graphic designer (Google's Imagen model) to create a brand new one.
3.  **Final Composition**: It takes the image (either original or newly generated), the new headline, the Dhaka Dispatch logo, and a stylish overlay, and combines them into the final, polished social media post.
4.  **Instant Delivery**: As soon as a post is fully assembled, it's sent to your workflow (the Make.com webhook) and the final bundle of all 6 results is sent at the very end.

This streamlined process—**Gather -> Translate -> Analyze -> Process in Parallel**—is fast, reliable, and makes the best use of all the available tools.
