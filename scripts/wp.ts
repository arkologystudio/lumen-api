// Define an interface for the WordPress page data structure
interface WordPressPage {
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  slug: string;
  // Add other properties as needed
}

const getAllPages = async () => {
  try {
    // First, let's get all pages to see what's available
    const response = await fetch(
      "https://www.culturehack.io/wp-json/wp/v2/pages"
    );
    const data = (await response.json()) as WordPressPage[];
    console.log(
      "Available pages:",
      data.map((page) => ({
        slug: page.slug,
        title: page.title.rendered,
      }))
    );
  } catch (error) {
    console.error("Error fetching pages:", error);
  }
};

const getAllPosts = async () => {
  try {
    // First, let's get all pages to see what's available
    const response = await fetch(
      "https://www.culturehack.io/wp-json/wp/v2/curriculum-modules"
    );
    const data = (await response.json()) as WordPressPage[];
    console.log(data);
    console.log(
      "Available posts:",
      data.map((post) => ({
        slug: post.slug,
        title: post.title.rendered,
      }))
    );
  } catch (error) {
    console.error("Error fetching pages:", error);
  }
};

const getCurriculumData = async () => {
  try {
    const response = await fetch(
      "http://culturehack.io/wp-json/wp/v2/curriculum"
    );
    const data = (await response.json()) as WordPressPage[];
    if (data.length > 0) {
      const page = data[0];
      console.log("Page Title:", page.title.rendered);
      console.log("Page Content:", page.content.rendered);
      // Process other page elements as needed
    } else {
      console.log("Page not found.");
    }
  } catch (error) {
    console.error("Error fetching page:", error);
  }
};

const main = async () => {
  try {
    // await getAllPages();
    await getCurriculumData();
    // await getAllPosts();
  } catch (error) {
    console.error("Error fetching pages:", error);
  }
};

main();
