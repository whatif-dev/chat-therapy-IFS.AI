import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import Replicate from "replicate";
import { PartImageUrls } from "@/app/constants";

const f = createUploadthing();

const auth = (req: Request) => ({ id: "fakeUserId" }); // Fake auth function

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function makePartImages(inputUrl: string): Promise<PartImageUrls> {
  const prompts = {
    manager:
      "A photo of a person img upclose, facing camera, looking mature confident and controlled, professional outfit, upright posture, orderly surroundings, muted background colors, symbols of achievement, sense of discipline and responsibility",
    firefighter:
      "A photo of a person img upclose, facing camera, fierce expression, intense eyes, firefighter, bold outfit, fiery background colors, sense of urgency and strength",
    exile:
      "A photo of a child img upclose, facing camera, young and extremely vulnerable, infant, eyes filled with fear and uncertainty, tattered and worn clothing, dark and shadowy background colors, bruises and scratches visible on skin, sense of deep isolation, desperately seeking safety, care, and acceptance",
  };

  return Object.fromEntries(
    await Promise.all(
      Object.entries(prompts).map(async ([part, prompt]) => [
        part,
        (
          await replicate.run(
            "tencentarc/photomaker:ddfc2b08d209f9fa8c1eca692712918bd449f695dabb4a958da31802a9570fe4",
            {
              input: {
                prompt: prompt,
                num_steps: 40,
                style_name: "Photographic (Default)",
                input_image: inputUrl,
                num_outputs: 1,
                guidance_scale: 5,
                negative_prompt:
                  "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry",
                style_strength_ratio: 20,
              },
            },
          )
        )[0],
      ]),
    ),
  );
}

// FileRouter for your app, can contain multiple FileRoutes
export const fileRouter = {
  // Define as many FileRoutes as you like, each with a unique routeSlug
  imageUploader: f({ image: { maxFileSize: "16MB" } })
    // Set permissions and file types for this FileRoute
    .middleware(async ({ req }) => {
      // This code runs on your server before upload
      const user = await auth(req);

      // If you throw, the user will not be able to upload
      if (!user) throw new UploadThingError("Unauthorized");

      // Whatever is returned here is accessible in onUploadComplete as `metadata`
      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // This code RUNS ON YOUR SERVER after upload
      console.log("Upload complete for userId:", metadata.userId);

      console.log("file url", file.url);
      const partImageUrls = await makePartImages(file.url);

      console.log("Got image urls", partImageUrls);

      // !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
      return { uploadedBy: metadata.userId, imageUrl: file.url, partImageUrls: partImageUrls };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof fileRouter;
