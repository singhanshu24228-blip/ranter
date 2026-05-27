import { useEffect, useState } from "react";
import api from "./api";

const categories = ["Clothing", "Electronics", "Bike", "Cars", "Furniture", "Book"];
const authRoles = [
  { id: "user", label: "User" },
  { id: "delivery", label: "Delivery" },
  { id: "admin", label: "Admin" },
];

const initialFormState = {
  category: "",
  rentCost: "",
  brandName: "",
  productDescription: "",
  buildingNo: "",
  landmark: "",
  street: "",
  village: "",
  city: "",
  district: "",
  state: "",
  address: "",
  pinCode: "",
  phoneNumber: "",
};

const initialRentFormState = {
  phoneNumber: "",
  buildingNo: "",
  landmark: "",
  street: "",
  village: "",
  city: "",
  district: "",
  state: "",
  pinCode: "",
  rentalDays: "",
};

const initialAuthFormState = {
  username: "",
  email: "",
  phoneNumber: "",
  password: "",
  buildingNo: "",
  landmark: "",
  street: "",
  village: "",
  city: "",
  district: "",
  state: "",
  address: "",
};

const restrictedSections = ["add-item", "your-items", "your-orders", "pickup-delivery"];

const roleThemes = {
  guest: {
    shellClass: "role-guest",
    title: "rentera",
    subtitle: "Marketplace access",
    homeLabel: "Home",
    pickupLabel: "Pickup Delivery",
  },
  user: {
    shellClass: "role-user",
    // eyebrow: "Renter and seller workspace",
    // title: "Rentera User Hub",
    title: "rentera",
    subtitle: "Listings, rentals, and orders",
    homeLabel: "Marketplace",
    pickupLabel: "Pickup Delivery",
  },
  delivery: {
    shellClass: "role-delivery",
    title: "rentera",
    subtitle: "Assigned jobs and route tracking",
    homeLabel: "Delivery Desk",
    pickupLabel: "Route Queue",
  },
  admin: {
    shellClass: "role-admin",
    eyebrow: "Operations control room",
    title: "rentera",
    subtitle: "Oversight across logistics",
    homeLabel: "Control Room",
    pickupLabel: "Logistics Board",
  },
};

function resolveInitialSection() {
  return window.location.pathname === "/pickup_delivery" ? "pickup-delivery" : "browse";
}

function formatAddressDetail(values) {
  const addressParts = [
    values.buildingNo,
    values.landmark ? `Landmark: ${values.landmark}` : "",
    values.street ? `Street: ${values.street}` : "",
    values.village ? `Village: ${values.village}` : "",
    values.city ? `City: ${values.city}` : "",
    values.district ? `District: ${values.district}` : "",
    values.state ? `State: ${values.state}` : "",
    values.address,
  ].filter(Boolean);

  return addressParts.join(", ");
}

/**
 * Calculates a proximity score between two addresses.
 * Higher score means the addresses are likely closer.
 */
function calculateProximityScore(userAddress, targetAddress) {
  if (!userAddress || !targetAddress) return 0;

  const u = userAddress.toLowerCase();
  const t = targetAddress.toLowerCase();

  let score = 0;

  // Pin code match is the strongest signal (6-digit format)
  const pinRegex = /\b\d{6}\b/g;
  const uPins = u.match(pinRegex) || [];
  const tPins = t.match(pinRegex) || [];

  for (const pin of uPins) {
    if (tPins.includes(pin)) score += 1000;
  }

  // Match common address components (City, District, Street names)
  // Filtering for words > 3 chars to avoid common small words
  const components = u.split(/[,\s]+/).filter((c) => c.length > 3);
  for (const comp of components) {
    if (t.includes(comp)) {
      score += 10;
    }
  }

  return score;
}

function buildMenuSections(currentUser) {
  const roleTheme = roleThemes[currentUser?.role || "guest"];
  const sections = [
    { id: "auth", label: "Auth" },
    { id: "browse", label: roleTheme.homeLabel },
  ];

  if (currentUser?.role === "user") {
    sections.push(
      { id: "add-item", label: "Add item" },
      { id: "your-items", label: "Your item" },
      { id: "your-orders", label: "Your order" },
      { id: "settings", label: "Settings" }
    );
  } else if (currentUser?.role === "delivery" || currentUser?.role === "admin") {
    sections.push(
      { id: "pickup-delivery", label: roleTheme.pickupLabel },
      { id: "settings", label: "Settings" }
    );
  }

  sections.push({ id: "help", label: "Help" });
  return sections;
}

export default function App() {
  const [activeSection, setActiveSection] = useState(() => {
    const storedUser = window.localStorage.getItem("rentera-user");
    return storedUser ? (window.location.pathname === "/pickup_delivery" ? "pickup-delivery" : "browse") : resolveInitialSection();
  });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [allItems, setAllItems] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [formState, setFormState] = useState(initialFormState);
  const [files, setFiles] = useState({
    mainImage: null,
    additionalImage: null,
    video: null,
  });
  const [previews, setPreviews] = useState({
    mainImage: "",
    additionalImage: "",
    video: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRentItemId, setSelectedRentItemId] = useState("");
  const [rentFormState, setRentFormState] = useState(initialRentFormState);
  const [rentFiles, setRentFiles] = useState({ panCardImage: null, aadhaarCardImage: null });
  const [rentPreviews, setRentPreviews] = useState({ panCardImage: "", aadhaarCardImage: "" });
  const [editingItemId, setEditingItemId] = useState("");
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = window.localStorage.getItem("rentera-user");
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authRole, setAuthRole] = useState("user");
  const [authFormState, setAuthFormState] = useState(initialAuthFormState);
  const [deliveryView, setDeliveryView] = useState("incomplete");
  const [orderView, setOrderView] = useState("you-rent");
  const [adminDeliveryForm, setAdminDeliveryForm] = useState(initialAuthFormState);
  const [adminMessage, setAdminMessage] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedViewItemId, setSelectedViewItemId] = useState("");
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsData, setEarningsData] = useState(null);
  const [showSellerEarningsModal, setShowSellerEarningsModal] = useState(false);
  const [sellerEarningsData, setSellerEarningsData] = useState(null);
  const [adminRequests, setAdminRequests] = useState({ deliveryRequests: [], sellerRequests: [] });
  const [sellerPaymentMethod, setSellerPaymentMethod] = useState("upi");
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState("upi");
  const [settingsOtpMode, setSettingsOtpMode] = useState("");
  const [settingsOtp, setSettingsOtp] = useState("");
  const [settingsNewEmail, setSettingsNewEmail] = useState("");
  const [isLocationFormVisible, setIsLocationFormVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        const requests = [
          api.get("/items", { params: selectedCategory === "all" ? {} : { category: selectedCategory } }),
          currentUser?.role === "user" ? api.get("/items", { params: { ownerUserId: currentUser._id } }) : Promise.resolve({ data: [] }),
          currentUser?.role === "user" ? api.get("/orders", { params: { userId: currentUser._id } }) : Promise.resolve({ data: [] }),
          currentUser?.role === "delivery"
            ? api.get("/orders", { params: { userId: currentUser._id, view: "pickup_delivery" } })
            : currentUser?.role === "admin"
              ? api.get("/orders", { params: { view: "pickup_delivery" } })
              : Promise.resolve({ data: [] }),
          currentUser?.role === "admin"
            ? api.get("/earnings/admin/requests")
            : Promise.resolve({ data: { deliveryRequests: [], sellerRequests: [] } }),
        ];

        const [catalogResponse, allItemsResponse, ordersResponse, deliveryOrdersResponse, adminReqResponse] = await Promise.all(requests);
        setCatalogItems(catalogResponse.data);
        setAllItems(allItemsResponse.data);
        setOrders(ordersResponse.data);
        setDeliveryOrders(deliveryOrdersResponse.data);
        setAdminRequests(adminReqResponse.data);
      } catch (error) {
        setMessage(resolveError(error, "Unable to load data."));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentUser, selectedCategory]);

  useEffect(() => {
    if (currentUser) {
      window.localStorage.setItem("rentera-user", JSON.stringify(currentUser));
      return;
    }

    window.localStorage.removeItem("rentera-user");
    setAllItems([]);
    setOrders([]);
    setDeliveryOrders([]);
    setSelectedRentItemId("");
    setRentFormState(initialRentFormState);
    resetItemForm();
  }, [currentUser]);

  useEffect(() => {
    const nextPath = activeSection === "pickup-delivery" ? "/pickup_delivery" : "/";
    if (window.location.pathname !== nextPath) {
      window.history.replaceState({}, "", nextPath);
    }
  }, [activeSection]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isMobileMenuOpen]);

  useEffect(() => {
    function handlePopState() {
      setActiveSection(window.location.pathname === "/pickup_delivery" ? "pickup-delivery" : "browse");
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser && restrictedSections.includes(activeSection)) {
      setActiveSection(resolveInitialSection());
    }
  }, [activeSection, currentUser]);

  useEffect(() => {
    if (currentUser?.role === "user") {
      return;
    }

    if (["add-item", "your-items", "your-orders"].includes(activeSection)) {
      setActiveSection(currentUser?.role === "delivery" || currentUser?.role === "admin" ? "pickup-delivery" : "browse");
    }
  }, [activeSection, currentUser]);

  useEffect(() => {
    if (authRole === "admin" && authMode === "register") {
      setAuthMode("login");
    }
  }, [authMode, authRole]);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  function handleRentInputChange(event) {
    const { name, value } = event.target;
    setRentFormState((current) => ({ ...current, [name]: value }));
  }

  function handleRentFileChange(event) {
    const { name, files: selectedFiles } = event.target;
    const file = selectedFiles?.[0] || null;

    setRentFiles((current) => ({ ...current, [name]: file }));
    setRentPreviews((current) => ({
      ...current,
      [name]: file ? URL.createObjectURL(file) : "",
    }));
  }

  function handleAuthInputChange(event) {
    const { name, value } = event.target;
    setAuthFormState((current) => ({ ...current, [name]: value }));
  }

  function handleAdminInputChange(event) {
    const { name, value } = event.target;
    setAdminDeliveryForm((current) => ({ ...current, [name]: value }));
  }

  function handleFileChange(event) {
    const { name, files: selectedFiles } = event.target;
    const file = selectedFiles?.[0] || null;

    setFiles((current) => ({ ...current, [name]: file }));
    setPreviews((current) => ({
      ...current,
      [name]: file ? URL.createObjectURL(file) : "",
    }));
  }

  function resetItemForm() {
    setFormState(initialFormState);
    setFiles({ mainImage: null, additionalImage: null, video: null });
    setPreviews({ mainImage: "", additionalImage: "", video: "" });
    setEditingItemId("");
  }

  function resetAuthForm(nextMode = authMode) {
    setAuthMode(nextMode);
    setAuthFormState(initialAuthFormState);
  }

  function handleRoleChange(nextRole) {
    setAuthRole(nextRole);
    setMessage("");
    resetAuthForm("login");
    if (nextRole === "admin") {
      setAuthFormState({
        ...initialAuthFormState,
        email: "singh01@gmail.com",
        password: "anshu1234",
      });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "user") {
      setActiveSection("auth");
      setMessage("Only user accounts can publish an item.");
      return;
    }

    if (!/^\d{6}$/.test(formState.pinCode)) {
      setMessage("Pin code must be exactly 6 digits.");
      return;
    }

    if (!/^\d{10}$/.test(formState.phoneNumber)) {
      setMessage("Phone number must be exactly 10 digits.");
      return;
    }

    if (!editingItemId && !files.mainImage) {
      setMessage("Main image is required.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const combinedAddress = formatAddressDetail(formState);

      if (editingItemId) {
        const response = await api.put(`/items/${editingItemId}`, {
          ...formState,
          address: combinedAddress,
          ownerUserId: currentUser._id,
        });
        const updatedItem = response.data;

        setAllItems((current) => current.map((item) => (item._id === updatedItem._id ? updatedItem : item)));
        setCatalogItems((current) => {
          const withoutItem = current.filter((item) => item._id !== updatedItem._id);
          if (selectedCategory !== "all" && selectedCategory !== updatedItem.category) {
            return withoutItem;
          }

          return [updatedItem, ...withoutItem];
        });
        setOrders((current) =>
          current.map((order) =>
            order.item?._id === updatedItem._id
              ? {
                ...order,
                item: updatedItem,
              }
              : order,
          ),
        );
        setDeliveryOrders((current) =>
          current.map((order) =>
            order.item?._id === updatedItem._id
              ? {
                ...order,
                item: updatedItem,
              }
              : order,
          ),
        );
        resetItemForm();
        setMessage("Item updated successfully.");
      } else {
        const payload = new FormData();
        Object.entries({ ...formState, address: combinedAddress }).forEach(([key, value]) => {
          payload.append(key, value);
        });
        payload.append("ownerUserId", currentUser._id);
        Object.entries(files).forEach(([key, file]) => {
          if (file) {
            payload.append(key, file);
          }
        });

        const response = await api.post("/items", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setAllItems((current) => [response.data, ...current]);
        setCatalogItems((current) =>
          selectedCategory === "all" || selectedCategory === response.data.category
            ? [response.data, ...current]
            : current,
        );
        resetItemForm();
        setMessage("Item published successfully.");
      }

      setActiveSection("your-items");
    } catch (error) {
      setMessage(resolveError(error, editingItemId ? "Failed to update item." : "Failed to publish item."));
    } finally {
      setSubmitting(false);
    }
  }

  function beginEditItem(item) {
    setEditingItemId(item._id);
    setFormState({
      category: item.category,
      rentCost: String(item.rentCost),
      brandName: item.brandName,
      productDescription: item.productDescription,
      address: item.address,
      pinCode: item.pinCode,
      phoneNumber: item.phoneNumber,
    });
    setFiles({ mainImage: null, additionalImage: null, video: null });
    setPreviews({
      mainImage: item.media.mainImage || "",
      additionalImage: item.media.additionalImage || "",
      video: item.media.video || "",
    });
    setMessage("");
    setActiveSection("add-item");
  }

  async function handleDeleteItem(itemId) {
    if (!currentUser || (currentUser.role !== "user" && currentUser.role !== "admin")) {
      setActiveSection("auth");
      setMessage("Only user and admin accounts can manage items.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const params = currentUser.role === "admin"
        ? { adminId: currentUser._id }
        : { ownerUserId: currentUser._id };

      await api.delete(`/items/${itemId}`, { params });
      setAllItems((current) => current.filter((item) => item._id !== itemId));
      setCatalogItems((current) => current.filter((item) => item._id !== itemId));
      setOrders((current) => current.filter((order) => order.item?._id !== itemId));
      setDeliveryOrders((current) => current.filter((order) => order.item?._id !== itemId));

      if (editingItemId === itemId) {
        resetItemForm();
      }

      setMessage("Item deleted successfully.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to delete item."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    if (authMode === "register" && authRole === "admin") {
      setMessage("Admin account is login only.");
      return;
    }

    if (authMode === "register" && !String(authFormState.username).trim()) {
      setMessage("Username is required.");
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(authFormState.email)) {
      setMessage("Email must be valid.");
      return;
    }

    if (authMode === "register" && !/^\d{10}$/.test(authFormState.phoneNumber)) {
      setMessage("Phone number must be exactly 10 digits.");
      return;
    }

    const combinedAuthAddress = formatAddressDetail(authFormState);
    if (authMode === "register" && authRole === "delivery" && !combinedAuthAddress.trim()) {
      setMessage("Address is required for delivery accounts.");
      return;
    }

    if (authFormState.password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
      const payload =
        authMode === "register"
          ? {
            ...authFormState,
            address: combinedAuthAddress,
            role: authRole,
          }
          : {
            email: authFormState.email,
            password: authFormState.password,
            role: authRole,
          };

      const response = await api.post(endpoint, payload);
      setCurrentUser(response.data.user);
      resetAuthForm("login");
      setActiveSection(response.data.user.role === "delivery" || response.data.user.role === "admin" ? "pickup-delivery" : "browse");
      setMessage(authMode === "register" ? "Account created successfully." : "Logged in successfully.");
    } catch (error) {
      setMessage(resolveError(error, authMode === "register" ? "Failed to create account." : "Failed to log in."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setMessage("");
      console.log("Sending forgot password request to:", api.defaults.baseURL + "/auth/forgot-password", "with email:", authFormState.email);
      const response = await api.post("/auth/forgot-password", { email: authFormState.email });
      setMessage(response.data.message);
      setAuthMode("reset-password");
    } catch (error) {
      setMessage(resolveError(error, "Failed to send OTP."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPasswordSubmit(event) {
    event.preventDefault();
    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post("/auth/reset-password", {
        email: authFormState.email,
        otp,
        newPassword
      });
      setMessage(response.data.message);
      setAuthMode("login");
      setOtp("");
      setNewPassword("");
    } catch (error) {
      setMessage(resolveError(error, "Failed to reset password."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdminCreateDelivery(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "admin") {
      setAdminMessage("Only admin can create delivery accounts.");
      return;
    }

    const combinedAddress = formatAddressDetail(adminDeliveryForm);
    if (!combinedAddress.trim()) {
      setAdminMessage("Address is required for delivery accounts.");
      return;
    }

    try {
      setSubmitting(true);
      setAdminMessage("");

      const response = await api.post("/auth/register-delivery", {
        ...adminDeliveryForm,
        address: combinedAddress,
        adminEmail: "singh01@gmail.com",
        adminPassword: "anshu1234",
      });

      setAdminMessage(`Success: Delivery account for ${response.data.user.username} created.`);
      setAdminDeliveryForm(initialAuthFormState);
    } catch (error) {
      setAdminMessage(resolveError(error, "Failed to create delivery account."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateLocation(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "delivery") {
      setMessage("Only delivery partners can update their location.");
      return;
    }

    const combinedAddress = formatAddressDetail(authFormState);
    if (!combinedAddress.trim()) {
      setMessage("New location address is required.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const response = await api.put(`/auth/update/${currentUser._id}`, {
        address: combinedAddress,
      });

      setCurrentUser(response.data.user);
      setMessage("Location updated successfully.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to update location."));
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    setCurrentUser(null);
    setAuthRole("user");
    resetAuthForm("login");
    setActiveSection(resolveInitialSection());
    setMessage("Logged out successfully.");
  }

  async function handleSendSettingsOtp() {
    try {
      setSubmitting(true);
      setMessage("");
      await api.post("/auth/send-verification-otp", { userId: currentUser._id });
      setMessage("OTP sent to your current email address.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to send OTP."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSettingsSubmit(event) {
    event.preventDefault();
    if (!settingsOtp) {
      setMessage("OTP is required.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      if (settingsOtpMode === "email") {
        if (!/^\S+@\S+\.\S+$/.test(settingsNewEmail)) {
          setMessage("New email must be valid.");
          setSubmitting(false);
          return;
        }

        const response = await api.post("/auth/change-email", {
          userId: currentUser._id,
          otp: settingsOtp,
          newEmail: settingsNewEmail
        });

        setCurrentUser(response.data.user);
        window.localStorage.setItem("rentera-user", JSON.stringify(response.data.user));
        setMessage("Email changed successfully.");
        setSettingsOtpMode("");
        setSettingsOtp("");
        setSettingsNewEmail("");
      } else if (settingsOtpMode === "delete") {
        await api.post("/auth/delete-account", {
          userId: currentUser._id,
          otp: settingsOtp
        });

        window.localStorage.removeItem("rentera-user");
        handleLogout();
        return;
      }
    } catch (error) {
      setMessage(resolveError(error, "Operation failed."));
    } finally {
      setSubmitting(false);
    }
  }

  function beginRent(itemId) {
    if (!currentUser) {
      setActiveSection("auth");
      setMessage("Log in first to rent an item.");
      return;
    }

    if (currentUser.role !== "user") {
      setMessage("Only users can rent items.");
      return;
    }

    setSelectedRentItemId(itemId);
    setRentFormState(initialRentFormState);
    setRentFiles({ panCardImage: null, aadhaarCardImage: null });
    setRentPreviews({ panCardImage: "", aadhaarCardImage: "" });
    setMessage("");
  }

  async function handleRentSubmit(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "user") {
      setActiveSection("auth");
      setMessage("Only user accounts can place an order.");
      return;
    }

    if (!selectedRentItemId) {
      setMessage("Select an item before placing an order.");
      return;
    }

    if (!rentFiles.panCardImage) {
      setMessage("PAN card image is required.");
      return;
    }

    if (!rentFiles.aadhaarCardImage) {
      setMessage("Aadhaar card image is required.");
      return;
    }

    if (!/^\d{10}$/.test(rentFormState.phoneNumber)) {
      setMessage("Phone number must be exactly 10 digits.");
      return;
    }

    if (!/^\d{6}$/.test(rentFormState.pinCode)) {
      setMessage("Pin code must be exactly 6 digits.");
      return;
    }

    const combinedRentAddress = formatAddressDetail(rentFormState);
    if (!combinedRentAddress.trim()) {
      setMessage("Destination address is required.");
      return;
    }

    if (!/^\d+$/.test(rentFormState.rentalDays) || Number(rentFormState.rentalDays) < 1) {
      setMessage("Number of rental days must be at least 1.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      const payload = new FormData();
      payload.append("userId", currentUser._id);
      payload.append("itemId", selectedRentItemId);
      payload.append("address", combinedRentAddress);

      Object.entries(rentFormState).forEach(([key, value]) => {
        payload.append(key, value);
      });

      Object.entries(rentFiles).forEach(([key, file]) => {
        if (file) {
          payload.append(key, file);
        }
      });

      const response = await api.post("/orders", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setOrders((current) => [response.data, ...current]);

      // Reload catalog to reflect updated item availability
      const updatedCatalogResponse = await api.get("/items", { params: selectedCategory === "all" ? {} : { category: selectedCategory } });
      setCatalogItems(updatedCatalogResponse.data);

      setSelectedRentItemId("");
      setRentFormState(initialRentFormState);
      setRentFiles({ panCardImage: null, aadhaarCardImage: null });
      setRentPreviews({ panCardImage: "", aadhaarCardImage: "" });
      setActiveSection("your-orders");
      setMessage("Order placed successfully.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to place order."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClaimItemDelivery(itemId) {
    if (!currentUser || currentUser.role !== "delivery") {
      setMessage("Only delivery partners can claim items.");
      return;
    }

    const orderToClaim = deliveryOrders.find(o => o.item?._id === itemId);
    if (orderToClaim) {
      const itemAddress = `${orderToClaim.item.address || ''} - ${orderToClaim.item.pinCode || ''}`.trim();
      const renterAddress = `${orderToClaim.renter?.address || ''} - ${orderToClaim.renter?.pinCode || ''}`.trim();

      const confirmMessage = `Job Details for ${orderToClaim.item.brandName}\n\n📍 Pickup Address (Seller):\n${itemAddress || 'Not provided'}\n\n📍 Delivery Address (Renter):\n${renterAddress || 'Not provided'}\n\nDo you want to claim this job?`;

      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/claim-item/${itemId}`, { deliveryUserId: currentUser._id });
      const newOrder = response.data;

      setDeliveryOrders((current) => {
        const exists = current.some(o => o._id === newOrder._id);
        if (exists) {
          return current.map(o => o._id === newOrder._id ? newOrder : o);
        }
        return [newOrder, ...current];
      });
      setMessage("Delivery job created and assigned to you.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to claim delivery."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApproveOrder(orderId) {
    if (!currentUser || currentUser.role !== "admin") return;
    const chargeInput = window.prompt("Enter delivery charge (optional, default is 0):", "0");
    if (chargeInput === null) return; // cancelled

    const deliveryCharge = Number(chargeInput) || 0;

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/${orderId}/approve`, { deliveryCharge });
      const updatedOrder = response.data;
      setDeliveryOrders((current) => current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)));
      setMessage(`Order approved for delivery with a charge of ₹${deliveryCharge}.`);
    } catch (error) {
      setMessage(resolveError(error, "Failed to approve order."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDeliveryCharge(orderId) {
    if (!currentUser || currentUser.role !== "admin") return;
    const chargeInput = window.prompt("Enter new delivery charge:", "0");
    if (chargeInput === null) return;

    const deliveryCharge = Number(chargeInput) || 0;

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/${orderId}/delivery-charge`, { deliveryCharge });
      const updatedOrder = response.data;
      setDeliveryOrders((current) => current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)));
      setMessage(`Delivery charge updated to ₹${deliveryCharge}.`);
    } catch (error) {
      setMessage(resolveError(error, "Failed to update delivery charge."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteOrder(orderId) {
    if (!currentUser || currentUser.role !== "admin") return;
    if (!window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) return;

    try {
      setSubmitting(true);
      setMessage("");
      await api.delete(`/orders/${orderId}`, { params: { adminId: currentUser._id } });
      setDeliveryOrders((current) => current.filter((order) => order._id !== orderId));
      setMessage("Order deleted successfully.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to delete order."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUserDeleteOrder(orderId) {
    if (!currentUser) return;
    if (!window.confirm("Are you sure you want to delete this order?")) return;

    try {
      setSubmitting(true);
      setMessage("");
      await api.delete(`/orders/${orderId}`, { params: { userId: currentUser._id } });
      setOrders((current) => current.filter((order) => order._id !== orderId));
      setMessage("Order deleted successfully.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to delete order."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayment(order) {
    try {
      setSubmitting(true);
      setMessage("");
      const res = await api.post(`/payments/${order._id}/create`);
      const paymentOrder = res.data;

      const options = {
        key: "rzp_live_Ss66wqcYTIqaEk", // using provided API key directly
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Rentera",
        description: `Payment for ${order.item.brandName}`,
        order_id: paymentOrder.id,
        handler: async function (response) {
          try {
            setSubmitting(true);
            const verifyRes = await api.post(`/payments/${order._id}/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const updatedOrder = verifyRes.data.order;
            setOrders((current) => current.map((o) => (o._id === updatedOrder._id ? updatedOrder : o)));
            setMessage("Payment successful. Receipt sent to your email.");
          } catch (error) {
            setMessage(resolveError(error, "Payment verification failed."));
          } finally {
            setSubmitting(false);
          }
        },
        prefill: {
          name: currentUser.username,
          email: currentUser.email,
          contact: currentUser.phoneNumber || order.renter?.phoneNumber || ""
        },
        theme: {
          color: "#3399cc"
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response) {
        setMessage("Payment failed. " + response.error.description);
      });
      rzp1.open();

    } catch (error) {
      setMessage(resolveError(error, "Failed to initialize payment."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAcceptDelivery(orderId) {
    if (!currentUser || currentUser.role !== "delivery") {
      setMessage("Only delivery partners can accept a delivery.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/${orderId}/assign-delivery`, { deliveryUserId: currentUser._id });
      const updatedOrder = response.data;
      setDeliveryOrders((current) => current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)));
      setMessage("Delivery added to your account.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to add delivery."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateOrderStatus(orderId, nextStatus) {
    if (!currentUser || (currentUser.role !== "delivery" && currentUser.role !== "admin")) {
      setMessage("Only delivery partners and admins can update order status.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      
      const payload = { nextStatus };
      if (currentUser.role === "admin") {
        payload.adminId = currentUser._id;
      } else {
        payload.deliveryUserId = currentUser._id;
      }
      
      const response = await api.post(`/orders/${orderId}/update-status`, payload);
      const updatedOrder = response.data;
      setDeliveryOrders((current) => current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)));

      // Reload catalog when item is returned to make it available for rent again
      if (nextStatus === "ReturnedToSeller") {
        const updatedCatalogResponse = await api.get("/items", { params: selectedCategory === "all" ? {} : { category: selectedCategory } });
        setCatalogItems(updatedCatalogResponse.data);
      }

      setMessage(`Order status updated to ${nextStatus}.`);
    } catch (error) {
      setMessage(resolveError(error, "Failed to update order status."));
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchEarnings() {
    if (!currentUser || currentUser.role !== "delivery") return;
    try {
      const response = await api.get(`/earnings/${currentUser._id}`);
      setEarningsData(response.data);
    } catch (error) {
      console.error("Failed to load earnings", error);
    }
  }

  async function handleRequestMoney(e) {
    e.preventDefault();
    const amount = Number(e.target.requestAmount.value);
    const upiId = e.target.upiId?.value || "";
    const accountNumber = e.target.accountNumber?.value || "";
    const ifscCode = e.target.ifscCode?.value || "";

    if (!upiId && (!accountNumber || !ifscCode)) {
      setMessage("Please provide either UPI ID or Bank Details (Account Number & IFSC Code).");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/earnings/${currentUser._id}/request`, {
        requestAmount: amount,
        upiId,
        accountNumber,
        ifscCode
      });
      setEarningsData(response.data.earning);
      setMessage(response.data.message);
      e.target.reset();
    } catch (error) {
      setMessage(resolveError(error, "Failed to request money."));
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchSellerEarnings() {
    if (!currentUser) return;
    try {
      const response = await api.get(`/earnings/seller/${currentUser._id}`);
      setSellerEarningsData(response.data);
    } catch (error) {
      console.error("Failed to load seller earnings", error);
    }
  }

  async function handleRequestSellerMoney(e) {
    e.preventDefault();
    const amount = Number(e.target.requestAmount.value);
    const upiId = e.target.upiId?.value || "";
    const accountNumber = e.target.accountNumber?.value || "";
    const ifscCode = e.target.ifscCode?.value || "";

    if (!upiId && (!accountNumber || !ifscCode)) {
      setMessage("Please provide either UPI ID or Bank Details (Account Number & IFSC Code).");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/earnings/seller/${currentUser._id}/request`, {
        requestAmount: amount,
        upiId,
        accountNumber,
        ifscCode
      });
      setSellerEarningsData(response.data.earning);
      setMessage(response.data.message);
      e.target.reset();
    } catch (error) {
      setMessage(resolveError(error, "Failed to request money."));
    } finally {
      setSubmitting(false);
    }
  }

  async function fetchAdminRequests() {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
      const response = await api.get("/earnings/admin/requests");
      setAdminRequests(response.data);
    } catch (error) {
      console.error("Failed to load admin requests", error);
    }
  }

  async function handleApproveRequest(id, type) {
    if (!currentUser || currentUser.role !== "admin") return;
    try {
      setSubmitting(true);
      setMessage("");
      await api.post(`/earnings/admin/approve/${id}`, { type });
      await fetchAdminRequests();
      setMessage("Request approved successfully.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to approve request."));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedRentItem = catalogItems.find((item) => item._id === selectedRentItemId);
  const orderedItemIds = new Set(
    orders
      .filter((order) => order.status !== "ReturnedToSeller")
      .map((order) => order.item?._id)
      .filter(Boolean)
  );
  const menuSections = buildMenuSections(currentUser);
  const assignedDeliveryOrders = deliveryOrders.filter((order) => order.deliveryPartner?._id === currentUser?._id);
  const incompleteDeliveryOrders =
    currentUser?.role === "delivery"
      ? assignedDeliveryOrders.filter((order) => order.status !== "ReturnedToSeller")
      : deliveryOrders.filter((order) => order.status !== "ReturnedToSeller");
  const completedDeliveryOrders =
    currentUser?.role === "delivery"
      ? assignedDeliveryOrders.filter((order) => order.status === "ReturnedToSeller")
      : deliveryOrders.filter((order) => order.status === "ReturnedToSeller");
  const pickupDeliveryList = deliveryView === "completed"
    ? completedDeliveryOrders
    : currentUser?.role === "delivery"
      ? incompleteDeliveryOrders
      : deliveryOrders.filter((order) => order.status !== "ReturnedToSeller");
  const currentRole = currentUser?.role || "guest";
  const roleTheme = roleThemes[currentRole];
  const openAdminOrders = deliveryOrders.filter((order) => !order.deliveryPartner).length;
  const assignedAdminOrders = deliveryOrders.filter((order) => order.deliveryPartner && order.status !== "Delivered").length;

  return (
    <div className={`page-shell ${roleTheme.shellClass}`}>
      <header className="topbar">
        <div className="brand-block">
          <div
            className="brand-mark"
            onClick={() => {
              setActiveSection("auth");
              setIsMobileMenuOpen(false);
            }}
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            title="Go to account"
          >
            {currentUser ? currentUser.username[0].toUpperCase() : "R"}
          </div>
          <div>
            {roleTheme.eyebrow && <p className="eyebrow">{roleTheme.eyebrow}</p>}
            <h1>{roleTheme.title}</h1>
          </div>
        </div>

        <button
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? "✕" : "☰"}
        </button>

        <nav className={`menu-strip ${isMobileMenuOpen ? "is-open" : ""}`} aria-label="Primary">
          {menuSections.map((section) => (
            <button
              key={section.id}
              className={`menu-link ${activeSection === section.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveSection(section.id);
                setIsMobileMenuOpen(false);
              }}
            >
              {section.label}
            </button>
          ))}
          {currentUser && (
            <button
              type="button"
              className="menu-link logout-mobile"
              onClick={() => {
                handleLogout();
                setIsMobileMenuOpen(false);
              }}
            >
              Log out
            </button>
          )}
        </nav>

        <div className="toolbar">
          {(currentRole === "guest" || currentRole === "user") && (
            <label className="category-select">
              <span>Category</span>
              <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(currentRole === "delivery" || currentRole === "admin") && (
            <div className="role-badge-panel">
              <span>{roleTheme.subtitle}</span>
              <strong>{currentRole === "delivery" ? `${incompleteDeliveryOrders.length} active jobs` : `${deliveryOrders.length} total logistics jobs`}</strong>
            </div>
          )}

        </div>
      </header>

      <main className="content-area">
        {activeSection === "auth" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Authentication</p>
                <h3>{currentUser ? "Your account" : "Login or sign up"}</h3>
              </div>
            </div>

            {currentUser ? (
              <div className="profile-card">
                <div className="detail-list">
                  <span>Username: {currentUser.username}</span>
                  <span>Email: {currentUser.email}</span>
                  <span>Role: {currentUser.role}</span>
                  {currentUser.phoneNumber ? <span>Phone number: {currentUser.phoneNumber}</span> : null}
                  {currentUser.address ? <span>Address: {currentUser.address}</span> : null}
                </div>
                <div className="card-actions">
                  <button type="button" className="primary-button" onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <form className="item-form" onSubmit={handleAuthSubmit}>


                <div className="auth-switch">
                  {authRoles.map((roleOption) => (
                    <button
                      key={roleOption.id}
                      type="button"
                      className={`menu-link ${authRole === roleOption.id ? "is-active" : ""}`}
                      onClick={() => handleRoleChange(roleOption.id)}
                    >
                      {roleOption.label}
                    </button>
                  ))}
                </div>

                <div className="auth-switch">
                  <button
                    type="button"
                    className={`menu-link ${authMode === "login" ? "is-active" : ""}`}
                    onClick={() => resetAuthForm("login")}
                  >
                    Log in
                  </button>
                  {authRole === "user" && (
                    <button
                      type="button"
                      className={`menu-link ${authMode === "register" ? "is-active" : ""}`}
                      onClick={() => resetAuthForm("register")}
                    >
                      Sign up
                    </button>
                  )}
                  {authMode === "forgot-password" && (
                    <button type="button" className="menu-link is-active">
                      Forgot Password
                    </button>
                  )}
                  {authMode === "reset-password" && (
                    <button type="button" className="menu-link is-active">
                      Reset Password
                    </button>
                  )}
                </div>

                {authRole === "admin" && (
                  <div className="credential-note">
                    <strong>Admin credentials</strong>
                    <span>Email: singh01@gmail.com</span>
                    <span>Password: anshu1234</span>
                  </div>
                )}

                <div className="form-grid">
                  {authMode === "forgot-password" ? (
                    <label className="full-width">
                      <span>Email</span>
                      <input
                        type="email"
                        name="email"
                        value={authFormState.email}
                        onChange={handleAuthInputChange}
                        placeholder="Enter your registered email"
                        required
                      />
                    </label>
                  ) : authMode === "reset-password" ? (
                    <>
                      <label className="full-width">
                        <span>Email</span>
                        <input
                          type="email"
                          name="email"
                          value={authFormState.email}
                          onChange={handleAuthInputChange}
                          required
                          disabled
                        />
                      </label>
                      <label>
                        <span>OTP</span>
                        <input
                          type="text"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          placeholder="6-digit OTP"
                          maxLength="6"
                          required
                        />
                      </label>
                      <label>
                        <span>New Password</span>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          required
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      {authMode === "register" && (
                        <>
                          <label>
                            <span>{authRole === "delivery" ? "Delivery username" : "Username"}</span>
                            <input
                              type="text"
                              name="username"
                              value={authFormState.username}
                              onChange={handleAuthInputChange}
                              placeholder="Your name"
                              required
                            />
                          </label>
                          <label>
                            <span>Phone number</span>
                            <input
                              type="tel"
                              name="phoneNumber"
                              value={authFormState.phoneNumber}
                              onChange={handleAuthInputChange}
                              maxLength="10"
                              placeholder="9876543210"
                              required
                            />
                          </label>
                        </>
                      )}
                      <label>
                        <span>Email</span>
                        <input
                          type="email"
                          name="email"
                          value={authFormState.email}
                          onChange={handleAuthInputChange}
                          required
                        />
                      </label>
                      <label>
                        <span>Password</span>
                        <input
                          type="password"
                          name="password"
                          value={authFormState.password}
                          onChange={handleAuthInputChange}
                          placeholder="Minimum 6 characters"
                          required
                        />
                      </label>
                      {authMode === "register" && authRole === "delivery" && (
                        <>
                          <label>
                            <span>Building no.</span>
                            <input type="text" name="buildingNo" value={authFormState.buildingNo} onChange={handleAuthInputChange} placeholder="123/A" required />
                          </label>
                          <label>
                            <span>Landmark</span>
                            <input type="text" name="landmark" value={authFormState.landmark} onChange={handleAuthInputChange} placeholder="Near market" />
                          </label>
                          <label>
                            <span>Street</span>
                            <input type="text" name="street" value={authFormState.street} onChange={handleAuthInputChange} placeholder="MG Road" required />
                          </label>
                          <label>
                            <span>Village</span>
                            <input type="text" name="village" value={authFormState.village} onChange={handleAuthInputChange} placeholder="Village name" />
                          </label>
                          <label>
                            <span>City</span>
                            <input type="text" name="city" value={authFormState.city} onChange={handleAuthInputChange} placeholder="City" required />
                          </label>
                          <label>
                            <span>District</span>
                            <input type="text" name="district" value={authFormState.district} onChange={handleAuthInputChange} placeholder="District" />
                          </label>
                          <label>
                            <span>State</span>
                            <input type="text" name="state" value={authFormState.state} onChange={handleAuthInputChange} placeholder="State" required />
                          </label>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="form-actions">
                  {authMode === "forgot-password" ? (
                    <button type="button" className="primary-button" onClick={handleForgotPasswordSubmit} disabled={submitting}>
                      {submitting ? "Sending OTP..." : "Send OTP"}
                    </button>
                  ) : authMode === "reset-password" ? (
                    <button type="button" className="primary-button" onClick={handleResetPasswordSubmit} disabled={submitting}>
                      {submitting ? "Resetting..." : "Reset Password"}
                    </button>
                  ) : (
                    <button type="submit" className="primary-button" disabled={submitting}>
                      {submitting ? (authMode === "register" ? "Creating..." : "Logging in...") : authMode === "register" ? "Create account" : "Log in"}
                    </button>
                  )}
                </div>

                {authMode === "login" && authRole === "user" && (
                  <div style={{ marginTop: "16px", textAlign: "center" }}>
                    <button
                      type="button"
                      className="menu-link"
                      style={{ fontSize: "0.9rem", color: "var(--primary)" }}
                      onClick={() => setAuthMode("forgot-password")}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
                {authMode === "forgot-password" && (
                  <div style={{ marginTop: "16px", textAlign: "center" }}>
                    <button
                      type="button"
                      className="menu-link"
                      style={{ fontSize: "0.9rem" }}
                      onClick={() => setAuthMode("login")}
                    >
                      Back to login
                    </button>
                  </div>
                )}
              </form>
            )}
          </section>
        )}

        {activeSection === "browse" && (
          <>
            {(currentRole === "guest" || currentRole === "user") && (
              <>
                <section className="hero-card">
                  <div className="hero-copy">
                    {/* <p className="eyebrow">Flipkart-inspired rental marketplace</p> */}
                    <h2> Hey! Let's Start Rent Something</h2>
                    {/* <p>Use the top menu to add new items, track your listings, and review placed rental orders.</p> */}
                  </div>
                  <div className="hero-stat-grid">
                    <button type="button" className="stat-card" onClick={() => setActiveSection("browse")}>
                      <strong>{catalogItems.length}</strong>
                      <span>Visible items</span>
                    </button>
                    {currentUser && (
                      <>
                        <button type="button" className="stat-card" onClick={() => setActiveSection("your-orders")}>
                          <strong>{orders.length}</strong>
                          <span>Your orders</span>
                        </button>
                        <button type="button" className="stat-card" onClick={() => setActiveSection("your-items")}>
                          <strong>{allItems.length}</strong>
                          <span>Your listed items</span>
                        </button>
                      </>
                    )}
                  </div>
                </section>

                {selectedViewItemId ? (
                  <section className="item-detail-view">
                    <button className="secondary-button back-button" onClick={() => setSelectedViewItemId("")}>
                      ← Back to marketplace
                    </button>
                    {(() => {
                      const item = catalogItems.find(i => i._id === selectedViewItemId);
                      if (!item) return <div className="empty-state">Item not found.</div>;
                      return (
                        <div className="detail-layout">
                          <div className="detail-media">
                            <img src={item.media.mainImage} alt={item.brandName} className="main-detail-img" />
                            <div className="side-media">
                              {item.media.additionalImage && <img src={item.media.additionalImage} alt="Additional" />}
                              {item.media.video && <video src={item.media.video} controls />}
                            </div>
                          </div>
                          <div className="detail-info">
                            <div className="meta-row">
                              <span className="tag">{item.category}</span>
                              <span className="price">Rs {item.rentCost}/day</span>
                            </div>
                            <h2>{item.brandName}</h2>
                            <p className="description">{item.productDescription}</p>
                            <div className="detail-specs">
                            </div>
                            {currentUser && (
                              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                                <button
                                  className="primary-button rent-now-cta"
                                  onClick={() => {
                                    setSelectedViewItemId("");
                                    beginRent(item._id);
                                  }}
                                  disabled={item.isAvailable === false || orderedItemIds.has(item._id)}
                                >
                                  {orderedItemIds.has(item._id) ? "Already ordered" : item.isAvailable === false ? "Currently Rented" : "Rent now"}
                                </button>
                                {currentUser.role === "admin" && (
                                  <>
                                    <button
                                      className="secondary-button"
                                      onClick={async () => {
                                        try {
                                          setSubmitting(true);
                                          const response = await api.put(`/items/${item._id}`, { adminId: currentUser._id, isAvailable: !item.isAvailable });
                                          const updatedItem = response.data;
                                          setCatalogItems((prev) => prev.map((i) => i._id === item._id ? updatedItem : i));
                                          setAllItems((prev) => prev.map((i) => i._id === item._id ? updatedItem : i));
                                          setMessage("Item status updated.");
                                        } catch (error) {
                                          setMessage(resolveError(error, "Failed to update item status."));
                                        } finally {
                                          setSubmitting(false);
                                        }
                                      }}
                                      disabled={submitting}
                                    >
                                      {item.isAvailable ? "Mark Unavailable" : "Mark Available"}
                                    </button>
                                    <button
                                      className="primary-button rent-now-cta"
                                      style={{ backgroundColor: "#d32f2f", color: "white" }}
                                      onClick={() => {
                                        if (window.confirm("Are you sure you want to delete this item?")) {
                                          setSelectedViewItemId("");
                                          handleDeleteItem(item._id);
                                        }
                                      }}
                                      disabled={submitting}
                                    >
                                      Delete Item
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                ) : (
                  <>
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">Available products</p>
                        <h3>Browse rental items</h3>
                      </div>
                      <p className="section-note">Filter using the category dropdown in the top bar.</p>
                    </div>

                    {selectedRentItem && (
                      <form className="rent-panel" onSubmit={handleRentSubmit}>
                        <div className="section-heading">
                          <div>
                            <p className="eyebrow">Renter verification</p>
                            <h3>Rent {selectedRentItem.brandName}</h3>
                          </div>
                          <button type="button" className="secondary-button" onClick={() => setSelectedRentItemId("")}>
                            Cancel
                          </button>
                        </div>

                        <div className="rent-summary">
                          <span className="tag">{selectedRentItem.category}</span>
                          <span className="price">Rs {selectedRentItem.rentCost}/day</span>
                        </div>

                        <div className="form-grid">
                          <label>
                            <span>PAN card image</span>
                            <input type="file" name="panCardImage" accept="image/*" onChange={handleRentFileChange} required />
                          </label>
                          <label>
                            <span>Aadhaar card image</span>
                            <input type="file" name="aadhaarCardImage" accept="image/*" onChange={handleRentFileChange} required />
                          </label>
                          <label>
                            <span>Phone number</span>
                            <input type="tel" name="phoneNumber" value={rentFormState.phoneNumber} onChange={handleRentInputChange} inputMode="tel" maxLength="10" placeholder="9876543210" required />
                          </label>
                          <label>
                            <span>Pin code</span>
                            <input type="text" name="pinCode" value={rentFormState.pinCode} onChange={handleRentInputChange} inputMode="numeric" maxLength="6" placeholder="110001" required />
                          </label>
                          <label>
                            <span>Building no.</span>
                            <input type="text" name="buildingNo" value={rentFormState.buildingNo} onChange={handleRentInputChange} placeholder="123/A" required />
                          </label>
                          <label>
                            <span>Landmark</span>
                            <input type="text" name="landmark" value={rentFormState.landmark} onChange={handleRentInputChange} placeholder="Near market" />
                          </label>
                          <label>
                            <span>Street</span>
                            <input type="text" name="street" value={rentFormState.street} onChange={handleRentInputChange} placeholder="MG Road" required />
                          </label>
                          <label>
                            <span>Village</span>
                            <input type="text" name="village" value={rentFormState.village} onChange={handleRentInputChange} placeholder="Village name" />
                          </label>
                          <label>
                            <span>City</span>
                            <input type="text" name="city" value={rentFormState.city} onChange={handleRentInputChange} placeholder="City" required />
                          </label>
                          <label>
                            <span>District</span>
                            <input type="text" name="district" value={rentFormState.district} onChange={handleRentInputChange} placeholder="District" />
                          </label>
                          <label>
                            <span>State</span>
                            <input type="text" name="state" value={rentFormState.state} onChange={handleRentInputChange} placeholder="State" required />
                          </label>
                          <label>
                            <span>No. of days for rent</span>
                            <input type="number" name="rentalDays" value={rentFormState.rentalDays} onChange={handleRentInputChange} min="1" max="7" placeholder="3" required />
                          </label>
                        </div>

                        <div className="form-actions">
                          <button type="submit" className="primary-button" disabled={submitting}>
                            {submitting ? "Placing order..." : "Confirm rent"}
                          </button>
                          {message && <p className="form-message">{message}</p>}
                        </div>
                      </form>
                    )}

                    {loading ? (
                      <div className="empty-state">Loading products...</div>
                    ) : catalogItems.length ? (
                      <div className="catalog-grid">
                        {catalogItems.map((item) => (
                          <article key={item._id} className="product-card" onClick={() => setSelectedViewItemId(item._id)} style={{ cursor: "pointer" }}>
                            <img src={item.media.mainImage} alt={item.brandName} />
                            <div className="card-body">
                              <div className="meta-row">
                                <span className="tag">{item.category}</span>
                                <span className="price">Rs {item.rentCost}/day</span>
                              </div>
                              <h4>{item.brandName}</h4>
                              <p className="description">{item.productDescription}</p>
                              <div className="card-actions" style={{ flexWrap: "wrap", gap: "8px" }}>
                                {currentUser && (
                                  <button
                                    className="primary-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      beginRent(item._id);
                                    }}
                                    disabled={item.isAvailable === false || orderedItemIds.has(item._id)}
                                  >
                                    {orderedItemIds.has(item._id) ? "Already ordered" : item.isAvailable === false ? "Currently Rented" : "Rent now"}
                                  </button>
                                )}
                                {currentUser?.role === "admin" && (
                                  <>
                                    <button
                                      className="secondary-button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        try {
                                          setSubmitting(true);
                                          const response = await api.put(`/items/${item._id}`, { adminId: currentUser._id, isAvailable: !item.isAvailable });
                                          const updatedItem = response.data;
                                          setCatalogItems((prev) => prev.map((i) => i._id === item._id ? updatedItem : i));
                                          setAllItems((prev) => prev.map((i) => i._id === item._id ? updatedItem : i));
                                          setMessage("Item status updated.");
                                        } catch (error) {
                                          setMessage(resolveError(error, "Failed to update item status."));
                                        } finally {
                                          setSubmitting(false);
                                        }
                                      }}
                                      disabled={submitting}
                                    >
                                      {item.isAvailable ? "Mark Unavailable" : "Mark Available"}
                                    </button>
                                    <button
                                      className="primary-button"
                                      style={{ backgroundColor: "#d32f2f", color: "white" }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm("Are you sure you want to delete this item?")) {
                                          handleDeleteItem(item._id);
                                        }
                                      }}
                                      disabled={submitting}
                                    >
                                      Delete Item
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">No items found for this category.</div>
                    )}
                  </>
                )}
              </>
            )}

            {currentUser?.role === "delivery" && (
              <>
                <section className="hero-card delivery-hero">

                  <div className="hero-stat-grid">
                    <article>
                      <strong>{incompleteDeliveryOrders.length}</strong>
                      <span>Incomplete deliveries</span>
                    </article>
                    <article>
                      <strong>{completedDeliveryOrders.length}</strong>
                      <span>Completed deliveries</span>
                    </article>
                    <article>
                      <strong>{deliveryOrders.filter((order) => !order.deliveryPartner).length}</strong>
                      <span>Open route jobs</span>
                    </article>
                  </div>
                </section>

                <section className="role-dashboard-grid">
                  <article className="role-focus-card">
                    <p className="eyebrow">Primary action</p>
                    <h3>Open route queue</h3>
                    <p>Go to `/pickup_delivery` to claim new jobs and manage your assigned deliveries.</p>
                    <button type="button" className="primary-button" onClick={() => setActiveSection("pickup-delivery")}>
                      Go to /pickup_delivery
                    </button>
                  </article>
                </section>

                <section className="panel" style={{ marginTop: "32px" }}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Available for pickup</p>
                      <h3>Delivery Desk</h3>
                    </div>

                  </div>

                  {loading ? (
                    <div className="empty-state">Loading marketplace jobs...</div>
                  ) : deliveryOrders.filter(o => !o.deliveryPartner).length ? (
                    <div className="catalog-grid">
                      {deliveryOrders
                        .filter(o => !o.deliveryPartner)
                        .sort((a, b) => {
                          const scoreA = calculateProximityScore(currentUser?.address, a.item?.address);
                          const scoreB = calculateProximityScore(currentUser?.address, b.item?.address);
                          return scoreB - scoreA;
                        })
                        .slice(0, 10)
                        .map((order) => {
                          const item = order.item;
                          if (!item) return null;

                          return (
                            <article key={item._id} className="product-card" onClick={() => handleClaimItemDelivery(item._id)} style={{ cursor: "pointer" }}>
                              <img src={item.media.mainImage} alt={item.brandName} />
                              <div className="card-body">
                                <div className="meta-row">
                                  <span className="tag">{item.category}</span>
                                  {calculateProximityScore(currentUser?.address, item.address) >= 1000 ? (
                                    <span className="tag" style={{ background: "var(--accent)", color: "var(--text)" }}>Near You</span>
                                  ) : (
                                    <span className="price">Unassigned Job</span>
                                  )}
                                </div>
                                <h4>{item.brandName}</h4>
                                <p className="description">{item.productDescription}</p>
                                <div className="card-actions">
                                  <button
                                    className="pickup-add-button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleClaimItemDelivery(item._id);
                                    }}
                                    disabled={submitting}
                                    title="Claim job"
                                  >
                                    +
                                  </button>
                                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                                    Job available
                                  </span>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="empty-state">No unassigned rental jobs available right now.</div>
                  )}
                </section>

                <section className="panel" style={{ marginTop: "32px" }}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Location settings</p>
                      <h3>Update your location</h3>
                    </div>
                  </div>
                  {!isLocationFormVisible ? (
                    <div style={{ marginTop: "16px" }}>
                      <p className="section-note" style={{ marginBottom: "16px" }}>Current: {currentUser.address}</p>
                      <button type="button" className="secondary-button" onClick={() => setIsLocationFormVisible(true)}>
                        Update location
                      </button>
                    </div>
                  ) : (
                    <form className="item-form" onSubmit={handleUpdateLocation}>
                      <p className="section-note" style={{ marginBottom: "16px" }}>Current: {currentUser.address}</p>
                      <div className="form-grid">
                        <label>
                          <span>Building no.</span>
                          <input type="text" name="buildingNo" value={authFormState.buildingNo} onChange={handleAuthInputChange} placeholder="123/A" required />
                        </label>
                        <label>
                          <span>Landmark</span>
                          <input type="text" name="landmark" value={authFormState.landmark} onChange={handleAuthInputChange} placeholder="Near market" />
                        </label>
                        <label>
                          <span>Street</span>
                          <input type="text" name="street" value={authFormState.street} onChange={handleAuthInputChange} placeholder="MG Road" required />
                        </label>
                        <label>
                          <span>Village</span>
                          <input type="text" name="village" value={authFormState.village} onChange={handleAuthInputChange} placeholder="Village name" />
                        </label>
                        <label>
                          <span>City</span>
                          <input type="text" name="city" value={authFormState.city} onChange={handleAuthInputChange} placeholder="City" required />
                        </label>
                        <label>
                          <span>District</span>
                          <input type="text" name="district" value={authFormState.district} onChange={handleAuthInputChange} placeholder="District" />
                        </label>
                        <label>
                          <span>State</span>
                          <input type="text" name="state" value={authFormState.state} onChange={handleAuthInputChange} placeholder="State" required />
                        </label>
                      </div>
                      <div className="form-actions" style={{ display: "flex", gap: "12px" }}>
                        <button type="submit" className="primary-button" disabled={submitting}>
                          {submitting ? "Updating..." : "Update location detail"}
                        </button>
                        <button type="button" className="secondary-button" onClick={() => setIsLocationFormVisible(false)} disabled={submitting}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              </>
            )}

            {currentUser?.role === "admin" && (
              <>
                <section className="hero-card admin-hero">
                  <div className="hero-copy">
                    <p className="eyebrow">Control room</p>
                    <h2>Track pickup demand, unclaimed jobs, and delivery completion from one operations board.</h2>
                    <p>This admin view is separated from the renter marketplace and focused on logistics oversight.</p>
                  </div>
                  <div className="hero-stat-grid">
                    <article>
                      <strong>{openAdminOrders}</strong>
                      <span>Open jobs</span>
                    </article>
                    <article>
                      <strong>{assignedAdminOrders}</strong>
                      <span>Assigned jobs</span>
                    </article>
                    <article>
                      <strong>{completedDeliveryOrders.length}</strong>
                      <span>Delivered jobs</span>
                    </article>
                  </div>
                </section>

                <section className="role-dashboard-grid">
                  <article className="role-focus-card">
                    <p className="eyebrow">Operations board</p>
                    <h3>Review logistics queue</h3>
                    <p>Use the logistics board to inspect open, assigned, and delivered rental orders.</p>
                    <button type="button" className="primary-button" onClick={() => setActiveSection("pickup-delivery")}>
                      Open logistics board
                    </button>
                  </article>
                  <article className="role-focus-card">
                    <p className="eyebrow">Admin scope</p>
                    <h3>Oversight only</h3>
                    <p>Admin is intentionally separated from renting and delivery claiming so the interface stays operational.</p>
                  </article>
                </section>

                <section className="panel" style={{ marginTop: "32px" }}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">User management</p>
                      <h3>Create delivery partner account</h3>
                    </div>
                  </div>
                  <form className="item-form" onSubmit={handleAdminCreateDelivery}>
                    {adminMessage && <div className="status-banner" style={{ marginBottom: "20px" }}>{adminMessage}</div>}
                    <div className="form-grid">
                      <label>
                        <span>Delivery username</span>
                        <input type="text" name="username" value={adminDeliveryForm.username} onChange={handleAdminInputChange} placeholder="Partner name" required />
                      </label>
                      <label>
                        <span>Email</span>
                        <input type="email" name="email" value={adminDeliveryForm.email} onChange={handleAdminInputChange} required />
                      </label>
                      <label>
                        <span>Phone number</span>
                        <input type="tel" name="phoneNumber" value={adminDeliveryForm.phoneNumber} onChange={handleAdminInputChange} maxLength="10" placeholder="9876543210" required />
                      </label>
                      <label>
                        <span>Password</span>
                        <input type="password" name="password" value={adminDeliveryForm.password} onChange={handleAdminInputChange} placeholder="Min 6 chars" required />
                      </label>
                      <label>
                        <span>Building no.</span>
                        <input type="text" name="buildingNo" value={adminDeliveryForm.buildingNo} onChange={handleAdminInputChange} placeholder="123/A" required />
                      </label>
                      <label>
                        <span>Landmark</span>
                        <input type="text" name="landmark" value={adminDeliveryForm.landmark} onChange={handleAdminInputChange} placeholder="Near market" />
                      </label>
                      <label>
                        <span>Street</span>
                        <input type="text" name="street" value={adminDeliveryForm.street} onChange={handleAdminInputChange} placeholder="MG Road" required />
                      </label>
                      <label>
                        <span>Village</span>
                        <input type="text" name="village" value={adminDeliveryForm.village} onChange={handleAdminInputChange} placeholder="Village name" />
                      </label>
                      <label>
                        <span>City</span>
                        <input type="text" name="city" value={adminDeliveryForm.city} onChange={handleAdminInputChange} placeholder="City" required />
                      </label>
                      <label>
                        <span>District</span>
                        <input type="text" name="district" value={adminDeliveryForm.district} onChange={handleAdminInputChange} placeholder="District" />
                      </label>
                      <label>
                        <span>State</span>
                        <input type="text" name="state" value={adminDeliveryForm.state} onChange={handleAdminInputChange} placeholder="State" required />
                      </label>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="primary-button" disabled={submitting}>
                        {submitting ? "Creating..." : "Create delivery partner"}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="panel" style={{ marginTop: "32px" }}>
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Financial operations</p>
                      <h3>Payout Requests</h3>
                    </div>
                  </div>

                  <div className="card-grid">
                    {adminRequests.sellerRequests.length > 0 || adminRequests.deliveryRequests.length > 0 ? (
                      <>
                        {adminRequests.sellerRequests.map((req) => (
                          <article key={req._id} className="info-card" style={{ borderLeft: "4px solid var(--primary)" }}>
                            <div className="card-body">
                              <div className="meta-row">
                                <span className="tag">Seller</span>
                                <span className="price">₹{req.amountRequested}</span>
                              </div>
                              <h4>{req.sellerUser?.username}</h4>
                              <div className="detail-list">
                                <span>Phone: {req.sellerUser?.phoneNumber}</span>
                                <span>Total Amount: ₹{req.totalAmount}</span>
                                <span>Amount Left: ₹{req.amountLeft}</span>
                                <div style={{ marginTop: "8px", padding: "8px", background: "#f5f5f5", borderRadius: "4px" }}>
                                  <strong>Payment Details:</strong>
                                  {req.paymentDetails?.upiId && <div>UPI ID: {req.paymentDetails.upiId}</div>}
                                  {req.paymentDetails?.accountNumber && <div>Account No: {req.paymentDetails.accountNumber}</div>}
                                  {req.paymentDetails?.ifscCode && <div>IFSC Code: {req.paymentDetails.ifscCode}</div>}
                                </div>
                              </div>
                              <div className="card-actions" style={{ marginTop: "16px" }}>
                                <button className="primary-button" onClick={() => handleApproveRequest(req._id, "seller")} disabled={submitting}>
                                  Approve Payment
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                        {adminRequests.deliveryRequests.map((req) => (
                          <article key={req._id} className="info-card" style={{ borderLeft: "4px solid var(--accent)" }}>
                            <div className="card-body">
                              <div className="meta-row">
                                <span className="tag">Delivery Partner</span>
                                <span className="price">₹{req.amountRequested}</span>
                              </div>
                              <h4>{req.deliveryPartner?.username}</h4>
                              <div className="detail-list">
                                <span>Phone: {req.deliveryPartner?.phoneNumber}</span>
                                <span>Total Amount: ₹{req.totalAmount}</span>
                                <span>Amount Left: ₹{req.amountLeft}</span>
                                <div style={{ marginTop: "8px", padding: "8px", background: "#f5f5f5", borderRadius: "4px" }}>
                                  <strong>Payment Details:</strong>
                                  {req.paymentDetails?.upiId && <div>UPI ID: {req.paymentDetails.upiId}</div>}
                                  {req.paymentDetails?.accountNumber && <div>Account No: {req.paymentDetails.accountNumber}</div>}
                                  {req.paymentDetails?.ifscCode && <div>IFSC Code: {req.paymentDetails.ifscCode}</div>}
                                </div>
                              </div>
                              <div className="card-actions" style={{ marginTop: "16px" }}>
                                <button className="primary-button" onClick={() => handleApproveRequest(req._id, "delivery")} disabled={submitting}>
                                  Approve Payment
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </>
                    ) : (
                      <div className="empty-state">No pending payout requests.</div>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {activeSection === "add-item" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{editingItemId ? "Update your product" : "List a product"}</p>
                <h3>{editingItemId ? "Edit item" : "Add item"}</h3>
              </div>
            </div>

            <form className="item-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <label>
                  <span>Main image</span>
                  <input type="file" name="mainImage" accept="image/*" onChange={handleFileChange} required={!editingItemId} />
                </label>
                <label>
                  <span>Additional image</span>
                  <input type="file" name="additionalImage" accept="image/*" onChange={handleFileChange} />
                </label>
                <label>
                  <span>Video</span>
                  <input type="file" name="video" accept="video/*" onChange={handleFileChange} />
                </label>
                <label>
                  <span>Category</span>
                  <select name="category" value={formState.category} onChange={handleInputChange} required>
                    <option value="">Choose category</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Rent cost per day</span>
                  <input type="number" min="1" name="rentCost" value={formState.rentCost} onChange={handleInputChange} placeholder="2500" required />
                </label>
                <label>
                  <span>{formState.category === "Book" ? "Book name" : "Product brand name"}</span>
                  <input type="text" name="brandName" value={formState.brandName} onChange={handleInputChange} placeholder={formState.category === "Book" ? "e.g. The Great Gatsby" : "Samsung, Honda, IKEA..."} required />
                </label>
                <label className="full-width">
                  <span>Product description</span>
                  <textarea rows="4" name="productDescription" value={formState.productDescription} onChange={handleInputChange} placeholder="Describe condition, model, size, and rental terms." required />
                </label>
                <label>
                  <span>Building no.</span>
                  <input type="text" name="buildingNo" value={formState.buildingNo} onChange={handleInputChange} placeholder="123/A" required />
                </label>
                <label>
                  <span>Landmark</span>
                  <input type="text" name="landmark" value={formState.landmark} onChange={handleInputChange} placeholder="Near market" />
                </label>
                <label>
                  <span>Street</span>
                  <input type="text" name="street" value={formState.street} onChange={handleInputChange} placeholder="MG Road" required />
                </label>
                <label>
                  <span>Village</span>
                  <input type="text" name="village" value={formState.village} onChange={handleInputChange} placeholder="Village name" />
                </label>
                <label>
                  <span>City</span>
                  <input type="text" name="city" value={formState.city} onChange={handleInputChange} placeholder="City" required />
                </label>
                <label>
                  <span>District</span>
                  <input type="text" name="district" value={formState.district} onChange={handleInputChange} placeholder="District" />
                </label>
                <label>
                  <span>State</span>
                  <input type="text" name="state" value={formState.state} onChange={handleInputChange} placeholder="State" required />
                </label>
                <label>
                  <span>Pin code</span>
                  <input type="text" inputMode="numeric" maxLength="6" name="pinCode" value={formState.pinCode} onChange={handleInputChange} placeholder="110001" required />
                </label>
                <label>
                  <span>Phone number</span>
                  <input type="tel" inputMode="tel" maxLength="10" name="phoneNumber" value={formState.phoneNumber} onChange={handleInputChange} placeholder="9876543210" required />
                </label>
              </div>

              <div className="media-preview-grid">
                <div className="preview-box">
                  <p>Main image preview</p>
                  {previews.mainImage ? <img src={previews.mainImage} alt="Main preview" /> : <div className="preview-fallback">No file selected</div>}
                </div>
                <div className="preview-box">
                  <p>Additional image preview</p>
                  {previews.additionalImage ? <img src={previews.additionalImage} alt="Additional preview" /> : <div className="preview-fallback">No file selected</div>}
                </div>
                <div className="preview-box">
                  <p>Video preview</p>
                  {previews.video ? <video src={previews.video} controls /> : <div className="preview-fallback">No file selected</div>}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={submitting}>
                  {submitting ? (editingItemId ? "Updating..." : "Publishing...") : editingItemId ? "Update item" : "Publish item"}
                </button>
                {editingItemId && (
                  <button type="button" className="secondary-button" onClick={resetItemForm}>
                    Cancel edit
                  </button>
                )}
                {message && <p className="form-message">{message}</p>}
              </div>
            </form>
          </section>
        )}

        {activeSection === "your-items" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Seller dashboard</p>
                <h3>Your item</h3>
              </div>
            </div>

            {allItems.length ? (
              <div className="card-grid">
                {allItems.map((item) => (
                  <article key={item._id} className="info-card">
                    <img src={item.media.mainImage} alt={item.brandName} />
                    <div className="card-body">
                      <div className="meta-row">
                        <span className="tag">{item.category}</span>
                        <span className="price">Rs {item.rentCost}/day</span>
                      </div>
                      <h4>{item.brandName}</h4>
                      <div className="detail-list">
                        <span>{item.productDescription}</span>
                        <span>{item.address} - {item.pinCode}</span>
                        <span>Phone: {item.phoneNumber}</span>
                      </div>
                      {orders.find(o => o.item._id === item._id) && (
                        <div className="delivery-stages-mini">
                          {(() => {
                            const order = orders.find(o => o.item._id === item._id);
                            return (
                              <>
                                <span className={`stage-dot ${order.pickedUpFromSellerAt ? "is-done" : ""}`} title="Picked up from seller">1</span>
                                <span className={`stage-dot ${order.deliveredToRenterAt ? "is-done" : ""}`} title="Delivered to renter">2</span>
                                <span className={`stage-dot ${order.pickedUpFromRenterAt ? "is-done" : ""}`} title="Picked up from renter">3</span>
                                <span className={`stage-dot ${order.returnedToSellerAt ? "is-done" : ""}`} title="Returned to owner">4</span>
                              </>
                            );
                          })()}
                        </div>
                      )}
                      <div className="card-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => beginEditItem(item)}
                          disabled={item.isAvailable === false}
                          title={item.isAvailable === false ? "Cannot edit while item is rented" : ""}
                        >
                          Edit item
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handleDeleteItem(item._id)}
                          disabled={submitting || item.isAvailable === false}
                          title={item.isAvailable === false ? "Cannot delete while item is rented" : ""}
                        >
                          Delete item
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No items listed yet.</div>
            )}
          </section>
        )}

        {activeSection === "your-orders" && (() => {
          const youRentOrders = orders.filter((o) => o.renterUser?._id === currentUser?._id);
          const yourRentOrders = orders.filter((o) => o.renterUser?._id !== currentUser?._id);
          const activeOrders = orderView === "you-rent" ? youRentOrders : yourRentOrders;

          return (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Order history</p>
                  <h3>Your order</h3>
                </div>
              </div>

              {/* Toggle */}
              <div className="order-view-toggle">
                <button
                  type="button"
                  className={`order-toggle-btn ${orderView === "you-rent" ? "is-active" : ""}`}
                  onClick={() => setOrderView("you-rent")}
                >
                  <span className="toggle-icon">🛒</span>
                  <span className="toggle-label">You Rent</span>
                  <span className="toggle-count">{youRentOrders.length}</span>
                </button>
                <button
                  type="button"
                  className={`order-toggle-btn ${orderView === "your-rent" ? "is-active" : ""}`}
                  onClick={() => setOrderView("your-rent")}
                >
                  <span className="toggle-icon">📦</span>
                  <span className="toggle-label">Your Rent</span>
                  <span className="toggle-count">{yourRentOrders.length}</span>
                </button>
                <button
                  type="button"
                  className="order-toggle-btn"
                  style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", padding: "0 16px" }}
                  onClick={() => {
                    if (!showSellerEarningsModal) fetchSellerEarnings();
                    setShowSellerEarningsModal(!showSellerEarningsModal);
                  }}
                  title="90% of rent amount will add after complete delivery"
                >
                  <span className="toggle-icon" style={{ fontSize: "1.5rem" }}>💰</span>
                </button>
              </div>

              {showSellerEarningsModal && (
                <div className="panel" style={{ marginTop: "16px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
                  <h4>Seller Earnings</h4>
                  <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "16px" }}>90% of rent amount will add after complete delivery</p>

                  {sellerEarningsData ? (
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginBottom: "16px" }}>
                        <div>
                          <strong>Total Earned:</strong> <br /> ₹{sellerEarningsData.totalAmount || 0}
                        </div>
                        <div>
                          <strong>Requested:</strong> <br /> ₹{sellerEarningsData.amountRequested || 0}
                        </div>
                        <div>
                          <strong>Available to Request:</strong> <br /> ₹{sellerEarningsData.amountLeft || 0}
                        </div>
                      </div>
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ marginRight: "16px" }}>
                          <input type="radio" name="sellerPaymentMethod" value="upi" checked={sellerPaymentMethod === "upi"} onChange={() => setSellerPaymentMethod("upi")} /> UPI ID
                        </label>
                        <label>
                          <input type="radio" name="sellerPaymentMethod" value="bank" checked={sellerPaymentMethod === "bank"} onChange={() => setSellerPaymentMethod("bank")} /> Bank Transfer
                        </label>
                      </div>
                      <form onSubmit={handleRequestSellerMoney} style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                        <label style={{ flex: "1 1 150px" }}>
                          <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>Request Amount</span>
                          <input type="number" name="requestAmount" max={sellerEarningsData.amountLeft} min="1" disabled={sellerEarningsData.amountLeft <= 0} required style={{ width: "100%", padding: "8px" }} />
                        </label>
                        {sellerPaymentMethod === "upi" && (
                          <label style={{ flex: "1 1 150px" }}>
                            <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>UPI ID</span>
                            <input type="text" name="upiId" style={{ width: "100%", padding: "8px" }} placeholder="Enter UPI ID" required />
                          </label>
                        )}
                        {sellerPaymentMethod === "bank" && (
                          <>
                            <label style={{ flex: "1 1 150px" }}>
                              <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>Account No.</span>
                              <input type="text" name="accountNumber" style={{ width: "100%", padding: "8px" }} placeholder="Account Number" required />
                            </label>
                            <label style={{ flex: "1 1 150px" }}>
                              <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>IFSC Code</span>
                              <input type="text" name="ifscCode" style={{ width: "100%", padding: "8px" }} placeholder="IFSC Code" required />
                            </label>
                          </>
                        )}
                        <button type="submit" className="primary-button" disabled={submitting || sellerEarningsData.amountLeft <= 0}>
                          Request Money
                        </button>
                      </form>
                    </div>
                  ) : (
                    <p>Loading earnings...</p>
                  )}
                </div>
              )}

              <p className="section-note order-view-desc">
                {orderView === "you-rent"
                  ? "Products you have rented from other users."
                  : "Your products that someone else has currently rented."}
              </p>

              {activeOrders.length ? (
                <div className="card-grid">
                  {activeOrders.map((order) => (
                    <article key={order._id} className="info-card">
                      <img src={order.item.media.mainImage} alt={order.item.brandName} />
                      <div className="card-body">
                        <div className="meta-row">
                          <span className="tag">{order.item.category}</span>
                          <span className="price">{order.status}</span>
                        </div>
                        <h4>{order.item.brandName}</h4>
                        <div className="detail-list">
                          <span>Rent cost: Rs {order.item.rentCost}/day</span>
                          {orderView === "you-rent" ? (
                            <>
                              <span>Delivery to: {order.renter?.address || "Not available"}</span>
                              <span>Rental days: {order.renter?.rentalDays || "Not available"}</span>
                            </>
                          ) : (
                            <>
                              <span>Rented by: {order.renterUser?.username || "Unknown"}</span>
                              <span>Their address: {order.renter?.address || "Not available"}</span>
                              <span>Rental days: {order.renter?.rentalDays || "Not available"}</span>
                            </>
                          )}
                          <span>Delivery partner: {order.deliveryPartner?.username || "Waiting for partner"}</span>
                        </div>
                        <div className="delivery-stages-mini">
                          <span className={`stage-dot ${order.pickedUpFromSellerAt ? "is-done" : ""}`} title="Picked up from seller">1</span>
                          <span className={`stage-dot ${order.deliveredToRenterAt ? "is-done" : ""}`} title="Delivered to renter">2</span>
                          <span className={`stage-dot ${order.pickedUpFromRenterAt ? "is-done" : ""}`} title="Picked up from renter">3</span>
                          <span className={`stage-dot ${order.returnedToSellerAt ? "is-done" : ""}`} title="Returned to owner">4</span>
                        </div>
                        {orderView === "you-rent" && order.status !== "Placed" && !order.isPaid && (
                          <div style={{ marginTop: "16px" }}>
                            <button type="button" className="primary-button" onClick={() => handlePayment(order)} disabled={submitting}>
                              Pay ₹{(order.item.rentCost * (order.renter?.rentalDays || 1)) + (order.deliveryCharge || 0)} Now
                            </button>
                          </div>
                        )}
                        {orderView === "you-rent" && order.isPaid && (
                          <div style={{ marginTop: "16px", color: "green", fontWeight: "bold" }}>
                            ✅ Payment Completed
                          </div>
                        )}
                        {orderView === "you-rent" && (order.status === "Placed" || order.status === "Approved") && (
                          <div style={{ marginTop: "16px" }}>
                            <button type="button" className="secondary-button" style={{ color: "#d32f2f", borderColor: "#d32f2f" }} onClick={() => handleUserDeleteOrder(order._id)} disabled={submitting}>
                              Cancel Order
                            </button>
                          </div>
                        )}
                        {orderView === "you-rent" && order.status === "ReturnedToSeller" && (
                          <div style={{ marginTop: "16px" }}>
                            <button type="button" className="secondary-button" onClick={() => handleUserDeleteOrder(order._id)} disabled={submitting}>
                              Remove from History
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  {orderView === "you-rent"
                    ? "You haven't rented any items yet."
                    : "No one has rented your items yet."}
                </div>
              )}
            </section>
          );
        })()}

        {activeSection === "pickup-delivery" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Pickup and delivery</p>
                <h3>/pickup_delivery</h3>
              </div>
              <p className="section-note">
                {currentUser?.role === "delivery"
                  ? "See incomplete and completed deliveries here, and claim open pickup tasks."
                  : "Admin can review all open pickup and delivery requests."}
              </p>
            </div>

            {currentUser?.role === "delivery" && (
              <>
                <div className="hero-stat-grid delivery-stat-grid">
                  <article>
                    <strong>{incompleteDeliveryOrders.length}</strong>
                    <span>Delivery incomplete</span>
                  </article>
                  <article>
                    <strong>{completedDeliveryOrders.length}</strong>
                    <span>Delivery completed</span>
                  </article>
                  <article>
                    <strong>/pickup_delivery</strong>
                    <span>Your delivery route page</span>
                  </article>
                  <article
                    style={{ cursor: "pointer", position: "relative" }}
                    onClick={() => {
                      if (!showEarningsModal) fetchEarnings();
                      setShowEarningsModal(!showEarningsModal);
                    }}
                    title="90% of delivery amount will add after complete delivery"
                  >
                    <strong style={{ fontSize: "2rem" }}>💰</strong>
                    <span>Your Earnings</span>
                  </article>
                </div>

                {showEarningsModal && (
                  <div className="panel" style={{ marginTop: "16px", backgroundColor: "#f9f9f9", border: "1px solid #ddd" }}>
                    <h4>Earnings Dashboard</h4>
                    <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "16px" }}>90% of delivery amount will add after complete delivery</p>

                    {earningsData ? (
                      <div>
                        <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                          <div>
                            <strong>Total Earned:</strong> <br /> ₹{earningsData.totalAmount || 0}
                          </div>
                          <div>
                            <strong>Requested:</strong> <br /> ₹{earningsData.amountRequested || 0}
                          </div>
                          <div>
                            <strong>Available to Request:</strong> <br /> ₹{earningsData.amountLeft || 0}
                          </div>
                        </div>
                        <div style={{ marginBottom: "16px" }}>
                          <label style={{ marginRight: "16px" }}>
                            <input type="radio" name="deliveryPaymentMethod" value="upi" checked={deliveryPaymentMethod === "upi"} onChange={() => setDeliveryPaymentMethod("upi")} /> UPI ID
                          </label>
                          <label>
                            <input type="radio" name="deliveryPaymentMethod" value="bank" checked={deliveryPaymentMethod === "bank"} onChange={() => setDeliveryPaymentMethod("bank")} /> Bank Transfer
                          </label>
                        </div>
                        <form onSubmit={handleRequestMoney} style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                          <label style={{ flex: "1 1 150px" }}>
                            <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>Request Amount</span>
                            <input type="number" name="requestAmount" max={earningsData.amountLeft} min="1" disabled={earningsData.amountLeft <= 0} required style={{ width: "100%", padding: "8px" }} />
                          </label>
                          {deliveryPaymentMethod === "upi" && (
                            <label style={{ flex: "1 1 150px" }}>
                              <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>UPI ID</span>
                              <input type="text" name="upiId" style={{ width: "100%", padding: "8px" }} placeholder="Enter UPI ID" required />
                            </label>
                          )}
                          {deliveryPaymentMethod === "bank" && (
                            <>
                              <label style={{ flex: "1 1 150px" }}>
                                <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>Account No.</span>
                                <input type="text" name="accountNumber" style={{ width: "100%", padding: "8px" }} placeholder="Account Number" required />
                              </label>
                              <label style={{ flex: "1 1 150px" }}>
                                <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>IFSC Code</span>
                                <input type="text" name="ifscCode" style={{ width: "100%", padding: "8px" }} placeholder="IFSC Code" required />
                              </label>
                            </>
                          )}
                          <button type="submit" className="primary-button" disabled={submitting || earningsData.amountLeft <= 0}>
                            Request Money
                          </button>
                        </form>
                      </div>
                    ) : (
                      <p>Loading earnings...</p>
                    )}
                  </div>
                )}

                <div className="auth-switch" style={{ marginTop: "24px" }}>
                  <button
                    type="button"
                    className={`menu-link ${deliveryView === "incomplete" ? "is-active" : ""}`}
                    onClick={() => setDeliveryView("incomplete")}
                  >
                    Delivery Incomplete
                  </button>
                  <button
                    type="button"
                    className={`menu-link ${deliveryView === "completed" ? "is-active" : ""}`}
                    onClick={() => setDeliveryView("completed")}
                  >
                    Delivery Completed
                  </button>
                </div>
              </>
            )}

            {loading ? (
              <div className="empty-state">Loading pickup and delivery orders...</div>
            ) : pickupDeliveryList.length ? (
              <div className="card-grid">
                {pickupDeliveryList.map((order) => {
                  const isAssignedToCurrentUser = order.deliveryPartner?._id === currentUser?._id;
                  const canChangeStatus = isAssignedToCurrentUser || currentUser?.role === "admin";
                  const isAvailable = !order.deliveryPartner;
                  const isCompleted = order.status === "Delivered";
                  const seller = order.item.ownerUser;

                  return (
                    <article key={order._id} className="info-card">
                      <img src={order.item.media.mainImage} alt={order.item.brandName} />
                      <div className="card-body">
                        <div className="meta-row">
                          <span className="tag">{order.item.category}</span>
                          <span className="price">{order.status}</span>
                        </div>
                        <h4>{order.item.brandName}</h4>
                        <div className="detail-list">
                          <div style={{ marginBottom: "12px", borderBottom: "1px solid #ddd", paddingBottom: "8px" }}>
                            <strong style={{ display: "block", marginBottom: "4px" }}>📍 Seller (Pickup):</strong>
                            <span>{seller?.username || "Not available"}</span><br />
                            <span>{order.item.address}</span><br />
                            <span>Pincode: {order.item.pinCode}</span><br />
                            <span>📞 {order.item.phoneNumber}</span>
                          </div>
                          <div style={{ marginBottom: "12px" }}>
                            <strong style={{ display: "block", marginBottom: "4px" }}>📍 Renter (Delivery):</strong>
                            <span>{order.renterUser?.username || "Not available"}</span><br />
                            <span>{order.renter?.address || "Not available"}</span><br />
                            <span>Pincode: {order.renter?.pinCode || "NA"}</span><br />
                            <span>📞 {order.renter?.phoneNumber || "Not available"}</span>
                            {currentUser?.role === "admin" && order.renter && (
                              <div style={{ marginTop: "8px", display: "flex", gap: "12px" }}>
                                <a href={order.renter.panCardImage} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "var(--primary)" }}>View PAN Card</a>
                                <a href={order.renter.aadhaarCardImage} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", color: "var(--primary)" }}>View Aadhaar Card</a>
                              </div>
                            )}
                          </div>
                          <span>
                            Rented till: {(() => {
                              const days = order.renter?.rentalDays || 0;
                              if (!days) return "Not available";
                              const start = order.deliveredToRenterAt ? new Date(order.deliveredToRenterAt) : new Date(order.createdAt);
                              const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
                              return end.toLocaleDateString();
                            })()}
                          </span>
                          <span>
                            Delivery partner: {order.deliveryPartner?.username || "Not assigned yet"}
                            {currentUser?.role === "admin" && order.deliveryPartner?.phoneNumber && ` (📞 ${order.deliveryPartner.phoneNumber})`}
                          </span>
                          {(currentUser?.role === "admin" || currentUser?.role === "delivery") && (
                            <span style={{ fontWeight: "bold", marginTop: "4px", display: "block" }}>
                              Delivery charge: ₹{order.deliveryCharge || 0}
                            </span>
                          )}
                        </div>
                        <div className="delivery-checklist">
                          <label className={`check-item ${order.pickedUpFromSellerAt ? "is-done" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!order.pickedUpFromSellerAt}
                              disabled={!canChangeStatus || !!order.pickedUpFromSellerAt || submitting}
                              onChange={() => handleUpdateOrderStatus(order._id, "PickedUpFromSeller")}
                            />
                            <span>1. Pickup from Seller</span>
                          </label>
                          <label className={`check-item ${order.deliveredToRenterAt ? "is-done" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!order.deliveredToRenterAt}
                              disabled={!canChangeStatus || !order.pickedUpFromSellerAt || !!order.deliveredToRenterAt || submitting}
                              onChange={() => handleUpdateOrderStatus(order._id, "DeliveredToRenter")}
                            />
                            <span>2. Delivery to Renter</span>
                          </label>
                          <label className={`check-item ${order.pickedUpFromRenterAt ? "is-done" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!order.pickedUpFromRenterAt}
                              disabled={!canChangeStatus || !order.deliveredToRenterAt || !!order.pickedUpFromRenterAt || submitting}
                              onChange={() => handleUpdateOrderStatus(order._id, "PickedUpFromRenter")}
                            />
                            <span>3. Pickup from Renter</span>
                          </label>
                          <label className={`check-item ${order.returnedToSellerAt ? "is-done" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!order.returnedToSellerAt}
                              disabled={!canChangeStatus || !order.pickedUpFromRenterAt || !!order.returnedToSellerAt || submitting}
                              onChange={() => handleUpdateOrderStatus(order._id, "ReturnedToSeller")}
                            />
                            <span>4. Return to Owner</span>
                          </label>
                        </div>
                        {currentUser?.role === "delivery" && isAvailable && (
                          <div className="card-actions">
                            <button type="button" className="pickup-add-button" onClick={() => handleAcceptDelivery(order._id)} disabled={submitting}>
                              + Claim Delivery
                            </button>
                          </div>
                        )}
                        {currentUser?.role === "admin" && (
                          <div className="card-actions" style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "12px" }}>
                            {order.status === "Placed" && (
                              <button type="button" className="primary-button" onClick={() => handleApproveOrder(order._id)} disabled={submitting}>
                                Approve for Delivery
                              </button>
                            )}
                            {order.status !== "Placed" && (
                              <button type="button" className="secondary-button" onClick={() => handleSetDeliveryCharge(order._id)} disabled={submitting}>
                                Set Delivery Charge
                              </button>
                            )}
                            <button type="button" className="primary-button" style={{ backgroundColor: "#d32f2f", color: "white" }} onClick={() => handleDeleteOrder(order._id)} disabled={submitting}>
                              Delete Order
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                {currentUser?.role === "delivery" && deliveryView === "completed"
                  ? "No completed deliveries yet."
                  : "No pickup and delivery orders available."}
              </div>
            )}
          </section>
        )}

        {activeSection === "settings" && (
          <section className="dashboard-section settings-section slide-in">
            <h2 className="section-title">Account Settings</h2>

            <div style={{ maxWidth: "500px" }}>
              {!settingsOtpMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="card" style={{ padding: "24px" }}>
                    <h3>Change Email</h3>
                    <p style={{ color: "#666", marginBottom: "16px" }}>Update your account email address. This requires OTP verification.</p>
                    <button className="primary-button" onClick={() => { setSettingsOtpMode("email"); handleSendSettingsOtp(); }}>
                      Change Email
                    </button>
                  </div>

                  <div className="card" style={{ padding: "24px", border: "1px solid #ffcdd2", backgroundColor: "#fff5f5" }}>
                    <h3 style={{ color: "#d32f2f" }}>Delete Account</h3>
                    <p style={{ color: "#666", marginBottom: "16px" }}>Permanently delete your account and all associated data.</p>
                    <button className="primary-button" style={{ backgroundColor: "#d32f2f", color: "white" }} onClick={() => { setSettingsOtpMode("delete"); handleSendSettingsOtp(); }}>
                      Delete Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding: "24px" }}>
                  <h3>{settingsOtpMode === "email" ? "Change Email" : "Delete Account"}</h3>
                  <form onSubmit={handleSettingsSubmit} className="auth-form" style={{ marginTop: "16px" }}>
                    {settingsOtpMode === "email" && (
                      <div className="form-group">
                        <label>
                          <span>New Email</span>
                          <input
                            type="email"
                            value={settingsNewEmail}
                            onChange={(e) => setSettingsNewEmail(e.target.value)}
                            placeholder="Enter new email"
                            required
                          />
                        </label>
                      </div>
                    )}

                    <div className="form-group">
                      <label>
                        <span>Verification OTP</span>
                        <input
                          type="text"
                          value={settingsOtp}
                          onChange={(e) => setSettingsOtp(e.target.value)}
                          placeholder="Enter 6-digit OTP sent to your current email"
                          maxLength="6"
                          required
                        />
                      </label>
                    </div>

                    <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                      <button type="submit" className="primary-button" disabled={submitting} style={settingsOtpMode === "delete" ? { backgroundColor: "#d32f2f", color: "white" } : {}}>
                        Confirm
                      </button>
                      <button type="button" className="secondary-button" onClick={() => { setSettingsOtpMode(""); setSettingsOtp(""); setSettingsNewEmail(""); }} disabled={submitting}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "help" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Support</p>
                <h3>Help</h3>
              </div>
            </div>

            <div className="help-grid">
              <article>
                <h4>How it works</h4>
                <p>This is platform where you can rent item of other user.</p>
                <p>Click on marketplace to see all item listed.</p>
                <p>You can see item based on category.</p>
                <p>You can also see item is avalilable for rent or not</p>
                <p>You can add item on click "Add item".</p>
                <p>Only <b>verified user</b> can rent your item.</p>
                <p>you can contact us between <b>10:00 am - 10:00 pm</b>.</p>
                <h4>Contact Us</h4>
                <p>
                  For any support or inquiries, please contact us at:<br />
                  📞 6205915327<br />
                  ✉️ singhanshu24228@gmail.com

                </p>
                <p></p>
              </article>
            </div>
          </section>
        )}

        {message && activeSection !== "add-item" && <div className="status-banner">{message}</div>}
      </main>
    </div>
  );
}

function resolveError(error, fallbackMessage) {
  return error?.response?.data?.message || fallbackMessage;
}
