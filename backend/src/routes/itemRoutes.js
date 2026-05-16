import { Router } from "express";
import { createItem, deleteItem, getItems, updateItem } from "../controllers/itemController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router
  .route("/")
  .get(getItems)
  .post(
    upload.fields([
      { name: "mainImage", maxCount: 1 },
      { name: "additionalImage", maxCount: 1 },
      { name: "video", maxCount: 1 },
    ]),
    createItem,
  );

router.route("/:itemId").put(updateItem).delete(deleteItem);

export default router;
