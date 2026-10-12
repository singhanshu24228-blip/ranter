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
  acceptedTerms: false,
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

function getCurrentCoordinates() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support location access."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error("Location access was denied or unavailable.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  });
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

function getRentalEndDate(order) {
  const rentalDays = order.renter?.rentalDays || 0;
  if (!rentalDays) return null;

  const rentalStart = order.deliveredToRenterAt
    ? new Date(order.deliveredToRenterAt)
    : new Date(order.createdAt);
  return new Date(rentalStart.getTime() + rentalDays * 24 * 60 * 60 * 1000);
}

export default function App() {
  const [activeSection, setActiveSection] = useState(() => {
    return window.location.pathname === "/pickup_delivery" ? "pickup-delivery" : resolveInitialSection();
  });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchLocation, setSearchLocation] = useState(null);
  const [selectedDistanceKm, setSelectedDistanceKm] = useState("all");
  const [searchRadiusKm, setSearchRadiusKm] = useState(0);
  const [locationLoading, setLocationLoading] = useState(false);
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
  const [authReady, setAuthReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [editingDeliveryChargeOrderId, setEditingDeliveryChargeOrderId] = useState("");
  const [deliveryChargeInput, setDeliveryChargeInput] = useState("");
  const [selectedRentItemId, setSelectedRentItemId] = useState("");
  const [rentFormState, setRentFormState] = useState(initialRentFormState);
  const [rentFiles, setRentFiles] = useState({ panCardImage: null, aadhaarCardImage: null });
  const [rentPreviews, setRentPreviews] = useState({ panCardImage: "", aadhaarCardImage: "" });
  const [editingItemId, setEditingItemId] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authRole, setAuthRole] = useState("user");
  const [authFormState, setAuthFormState] = useState(initialAuthFormState);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [deliveryView, setDeliveryView] = useState("incomplete");
  const [orderView, setOrderView] = useState("you-rent");
  const [adminDeliveryForm, setAdminDeliveryForm] = useState(initialAuthFormState);
  const [adminDeliveryConfirmPassword, setAdminDeliveryConfirmPassword] = useState("");
  const [showAdminDeliveryPassword, setShowAdminDeliveryPassword] = useState(false);
  const [showAdminDeliveryConfirmPassword, setShowAdminDeliveryConfirmPassword] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedViewItemId, setSelectedViewItemId] = useState("");
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsData, setEarningsData] = useState(null);
  const [sellerEarningsData, setSellerEarningsData] = useState(null);
  const [rentalExtensionDays, setRentalExtensionDays] = useState({});
  const [isRentalExtensionOpen, setIsRentalExtensionOpen] = useState({});
  const [adminRequests, setAdminRequests] = useState({ deliveryRequests: [], sellerRequests: [] });
  const [sellerPaymentMethod, setSellerPaymentMethod] = useState("upi");
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState("upi");
  const [settingsOtpMode, setSettingsOtpMode] = useState("");
  const [settingsOtp, setSettingsOtp] = useState("");
  const [settingsNewEmail, setSettingsNewEmail] = useState("");
  const [isLocationFormVisible, setIsLocationFormVisible] = useState(false);

  useEffect(() => {
    if (!authReady || !["guest", "user"].includes(currentUser?.role || "guest")) return;

    let isActive = true;
    setLocationLoading(true);
    getCurrentCoordinates()
      .then((coordinates) => {
        if (isActive) {
          setSearchLocation(coordinates);
          setMessage("");
        }
      })
      .catch((error) => {
        if (isActive) {
          setSearchLocation(null);
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (isActive) setLocationLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [authReady, currentUser?.role]);

  useEffect(() => {
    let isActive = true;
    api.get("/auth/session")
      .then((response) => {
        if (isActive) setCurrentUser(response.data.user);
      })
      .catch(() => {
        if (isActive) setCurrentUser(null);
      })
      .finally(() => {
        if (isActive) setAuthReady(true);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!authReady) return;

      try {
        setLoading(true);

        const catalogParams = selectedCategory === "all" ? {} : { category: selectedCategory };
        if (searchLocation && selectedDistanceKm !== "all") {
          catalogParams.latitude = searchLocation.latitude;
          catalogParams.longitude = searchLocation.longitude;
          catalogParams.maxDistanceKm = selectedDistanceKm;
        }

        const requests = [
          api.get("/items", { params: catalogParams }),
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
        setSearchRadiusKm(Number(catalogResponse.headers["x-search-radius-km"]) || 0);
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
  }, [authReady, currentUser, selectedCategory, searchLocation, selectedDistanceKm]);

  useEffect(() => {
    if (currentUser) return;
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
    if (authReady && !currentUser && restrictedSections.includes(activeSection)) {
      setActiveSection(resolveInitialSection());
    }
  }, [activeSection, authReady, currentUser]);

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

  function handleDistanceChange(event) {
    const distance = event.target.value;
    setSelectedDistanceKm(distance);
    setMessage("");
    if (distance !== "all" && !searchLocation) {
      setLocationLoading(true);
      getCurrentCoordinates()
        .then(setSearchLocation)
        .catch((error) => {
          setSearchLocation(null);
          setSelectedDistanceKm("all");
          setMessage(error.message);
        })
        .finally(() => setLocationLoading(false));
    }
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
    const { name, value, type, checked } = event.target;
    setAuthFormState((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
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
      const itemCoordinates = editingItemId ? null : await getCurrentCoordinates();

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
        payload.append("latitude", itemCoordinates.latitude);
        payload.append("longitude", itemCoordinates.longitude);
        payload.append("ownerUserId", currentUser._id);
        Object.entries(files).forEach(([key, file]) => {
          if (file) {
            payload.append(key, file);
          }
        });

        const response = await api.post("/items", payload);

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

    if (authMode === "register" && authRole === "user" && !authFormState.acceptedTerms) {
      setMessage("You must agree to the Terms & Conditions and Privacy Policy to create an account.");
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

    if (adminDeliveryForm.password !== adminDeliveryConfirmPassword) {
      setAdminMessage("Password and confirm password do not match.");
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
      });

      setAdminMessage(`Success: Delivery account for ${response.data.user.username} created.`);
      setAdminDeliveryForm(initialAuthFormState);
      setAdminDeliveryConfirmPassword("");
      setShowAdminDeliveryPassword(false);
      setShowAdminDeliveryConfirmPassword(false);
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

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {}
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
      await api.post("/auth/send-verification-otp", {
        purpose: settingsOtpMode === "delete" ? "account-deletion" : "email-change",
      });
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
          otp: settingsOtp,
          newEmail: settingsNewEmail
        });

        setCurrentUser(response.data.user);
        setMessage("Email changed successfully.");
        setSettingsOtpMode("");
        setSettingsOtp("");
        setSettingsNewEmail("");
      } else if (settingsOtpMode === "delete") {
        await api.post("/auth/delete-account", {
          otp: settingsOtp
        });

        await handleLogout();
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

      const response = await api.post("/orders", payload);
      setOrders((current) => [response.data, ...current]);

      setSelectedRentItemId("");
      setRentFormState(initialRentFormState);
      setRentFiles({ panCardImage: null, aadhaarCardImage: null });
      setRentPreviews({ panCardImage: "", aadhaarCardImage: "" });
      setActiveSection("your-orders");
      setMessage("Order placed successfully.");

      try {
        const updatedCatalogResponse = await api.get("/items", {
          params: selectedCategory === "all" ? {} : { category: selectedCategory },
        });
        setCatalogItems(updatedCatalogResponse.data);
      } catch (error) {
        setMessage(
          `Order placed successfully, but item availability could not be refreshed. ${resolveError(
            error,
            "Refresh the page to see the latest availability.",
          )}`,
        );
      }
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
    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/${orderId}/approve`);
      const updatedOrder = response.data;
      setDeliveryOrders((current) => current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)));
      setMessage("Order approved for delivery. You can now set the delivery charge.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to approve order."));
    } finally {
      setSubmitting(false);
    }
  }

  function beginSetDeliveryCharge(order) {
    setEditingDeliveryChargeOrderId(order._id);
    setDeliveryChargeInput(String(order.deliveryCharge ?? 0));
    setMessage("");
  }

  async function handleSetDeliveryCharge(event, orderId) {
    event.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;

    const deliveryCharge = Number(deliveryChargeInput);
    if (!Number.isFinite(deliveryCharge) || deliveryCharge < 0) {
      setMessage("Delivery charge must be a non-negative number.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/${orderId}/delivery-charge`, { deliveryCharge });
      const updatedOrder = response.data;
      setDeliveryOrders((current) => current.map((order) => (order._id === updatedOrder._id ? updatedOrder : order)));
      setEditingDeliveryChargeOrderId("");
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

  async function handleExtendRental(e, order) {
    e.preventDefault();
    const requestedRentalDays = Number(e.currentTarget.elements.rentalDays.value);
    const currentRentalDays = order.renter?.rentalDays || 0;

    if (!Number.isInteger(requestedRentalDays) || requestedRentalDays <= currentRentalDays || requestedRentalDays > 20) {
      setMessage("Choose a longer rental period, up to a maximum of 20 days.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const response = await api.post(`/orders/${order._id}/extend-rental`, {
        rentalDays: requestedRentalDays,
      });
      setOrders((current) => current.map((item) => (
        item._id === response.data._id ? response.data : item
      )));
      setRentalExtensionDays((current) => ({
        ...current,
        [order._id]: String(Math.min(requestedRentalDays + 1, 20)),
      }));
      setIsRentalExtensionOpen((current) => ({
        ...current,
        [order._id]: false,
      }));
      setMessage("Rental period extended. Pay the updated balance to complete payment.");
    } catch (error) {
      setMessage(resolveError(error, "Failed to extend rental."));
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
          <section className="panel auth-panel">
            {!currentUser && <div className="section-heading auth-heading"><p className="eyebrow">Authentication</p></div>}

            {currentUser ? (
              <div className="profile-card auth-profile-card">
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
              <div className="auth-layout">
                <form className="item-form auth-form" onSubmit={handleAuthSubmit}>
                  <div className="auth-tabs" aria-label="Account role">
                    {authRoles.map((roleOption) => (
                      <button
                        key={roleOption.id}
                        type="button"
                        className={`auth-tab ${authRole === roleOption.id ? "is-active" : ""}`}
                        onClick={() => handleRoleChange(roleOption.id)}
                      >
                        {roleOption.label}
                      </button>
                    ))}
                  </div>

                  <div className="auth-tabs auth-mode-tabs" aria-label="Authentication mode">
                    <button
                      type="button"
                      className={`auth-tab ${authMode === "login" ? "is-active" : ""}`}
                      onClick={() => resetAuthForm("login")}
                    >
                      Log in
                    </button>
                    {authRole === "user" && (
                      <button
                        type="button"
                        className={`auth-tab ${authMode === "register" ? "is-active" : ""}`}
                        onClick={() => resetAuthForm("register")}
                      >
                        Sign up
                      </button>
                    )}
                    {authMode === "forgot-password" && (
                      <button type="button" className="auth-tab is-active">
                        Forgot Password
                      </button>
                    )}
                    {authMode === "reset-password" && (
                      <button type="button" className="auth-tab is-active">
                        Reset Password
                      </button>
                    )}
                  </div>

                  <div className="form-grid auth-form-grid">
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
                        <div className="password-input-wrapper">
                          <input
                            type={showAuthPassword ? "text" : "password"}
                            name="password"
                            value={authFormState.password}
                            onChange={handleAuthInputChange}
                            placeholder="Minimum 6 characters"
                            required
                          />
                          <button
                            type="button"
                            className="password-visibility-toggle"
                            onClick={() => setShowAuthPassword((visible) => !visible)}
                            aria-label={`${showAuthPassword ? "Hide" : "Show"} password`}
                            title={`${showAuthPassword ? "Hide" : "Show"} password`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              {showAuthPassword ? (
                                <>
                                  <path d="M3 3l18 18" />
                                  <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                                  <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3" />
                                  <path d="M6.2 6.2C3.9 7.7 2.8 10 2.5 12c1 2.5 4.5 7 9.5 7 1.3 0 2.5-.3 3.5-.8" />
                                </>
                              ) : (
                                <>
                                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                                  <circle cx="12" cy="12" r="3" />
                                </>
                              )}
                            </svg>
                          </button>
                        </div>
                      </label>
                      {authMode === "register" && authRole === "user" && (
                        <label className="full-width checkbox-field">
                          <span>
                            I agree to the
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                setActiveSection("terms");
                                setAuthMode("register");
                              }}
                            >
                              Terms & Conditions
                            </button>
                            and
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                setActiveSection("privacy");
                                setAuthMode("register");
                              }}
                            >
                              Privacy Policy
                            </button>
                            .
                          </span>
                          <input
                            type="checkbox"
                            name="acceptedTerms"
                            checked={authFormState.acceptedTerms}
                            onChange={handleAuthInputChange}
                          />
                        </label>
                      )}
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

                  <div className="form-actions auth-submit-row">
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
                    <div className="auth-helper-row">
                      <button
                        type="button"
                        className="auth-text-button"
                        onClick={() => setAuthMode("forgot-password")}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                  {authMode === "forgot-password" && (
                    <div className="auth-helper-row">
                      <button
                        type="button"
                        className="auth-text-button"
                        onClick={() => setAuthMode("login")}
                      >
                        Back to login
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}
          </section>
        )}

        {activeSection === "terms" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Legal</p>
                <h3>Terms & Conditions</h3>
              </div>
            </div>
            <div className="legal-content">
              <p>By creating an account on Rentera, you agree to use the platform in accordance with these Terms & Conditions. You may not use the service for any unlawful purpose, and you agree to provide accurate information during signup.</p>
              
              <p>All rentals are subject to availability and the terms set by the item owner. Renters are responsible for returning items in the condition they were received, and may be liable for damages or loss.</p>
              <p>If rented item found damages renter must pay 30% of product original price and must  return that item.</p><p>Delivey charges may vary according to distance and product.</p>
              <p>By hitting "Create account", you confirm that you have read and accepted these Terms & Conditions and the Privacy Policy.</p>
            </div>
            <div className="card-actions">
              <button type="button" className="primary-button" onClick={() => setActiveSection("auth")}>Back to signup</button>
            </div>
          </section>
        )}

        {activeSection === "privacy" && (
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Legal</p>
                <h3>Privacy Policy</h3>
              </div>
            </div>
            <div className="legal-content">
              <p>Rentera collects and stores the information you provide during signup and when using the service. This includes contact details, rental listings, order history, and delivery information.</p>
              <p>We will never sell your personal information to third parties. We may use your data to provide the service, improve the platform, and communicate important updates.</p>
              <p>By creating an account, you agree to Rentera's collection and use of your information as described in this Privacy Policy.</p>
            </div>
            <div className="card-actions">
              <button type="button" className="primary-button" onClick={() => setActiveSection("auth")}>Back to signup</button>
            </div>
          </section>
        )}

        {activeSection === "browse" && (
          <>
            {(currentRole === "guest" || currentRole === "user") && (
              <>
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
                    <section className="marketplace-hero" aria-labelledby="marketplace-title">
                      <div className="marketplace-hero-copy">
                        <p className="marketplace-kicker">
                          <span aria-hidden="true" /> RENT BETTER, LIVE LIGHTER
                        </p>
                        <h2 id="marketplace-title">Good things are closer than you think.</h2>
                        <p className="marketplace-intro">
                          Discover useful finds from people nearby. Rent what you need, when you need it.
                        </p>
                        <a
                          className="marketplace-cta"
                          href="#marketplace-listings"
                          onClick={(event) => {
                            event.preventDefault();
                            document.getElementById("marketplace-listings")?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Explore the collection <span aria-hidden="true">↘</span>
                        </a>
                      </div>
                      <div className="marketplace-hero-aside">
                        <span className="marketplace-aside-label">A little closer to home</span>
                        <strong>Make room for more.</strong>
                        <p>Find your next favorite without making it yours forever.</p>
                        <div className="marketplace-hero-stats">
                          <div>
                            <strong>{catalogItems.length}</strong>
                            <span>{catalogItems.length === 1 ? "item to explore" : "items to explore"}</span>
                          </div>
                          <div>
                            <strong>{categories.length}</strong>
                            <span>ways to find it</span>
                          </div>
                        </div>
                        <div className="marketplace-category-links" aria-label="Popular categories">
                          {["Electronics", "Furniture", "Books"].map((category) => {
                            const categoryName = category === "Books" ? "Book" : category;
                            return (
                              <button
                                key={category}
                                type="button"
                                className="marketplace-category-chip"
                                onClick={() => {
                                  setSelectedCategory(categoryName);
                                  document.getElementById("marketplace-listings")?.scrollIntoView({ behavior: "smooth" });
                                }}
                              >
                                {category} <span aria-hidden="true">↗</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>

                    <div className="section-heading" id="marketplace-listings">
                      <div>
                        <p className="eyebrow">Available products</p>
                        <h3>Browse rental items</h3>
                      </div>
                      <div className="card-actions">
                        {searchLocation && selectedDistanceKm !== "all" && <span className="section-note">Showing items within {searchRadiusKm} km</span>}
                        {locationLoading && <span className="section-note">Finding your location...</span>}
                        <label className="distance-select">
                          <span>Distance</span>
                          <select
                            value={selectedDistanceKm}
                            onChange={handleDistanceChange}
                            disabled={locationLoading}
                          >
                            <option value="all">All products</option>
                            {[10, 20, 30, 50].map((distance) => (
                              <option key={distance} value={distance}>{distance} km</option>
                            ))}
                          </select>
                        </label>
                        {searchLocation && selectedDistanceKm !== "all" && (
                          <button type="button" className="secondary-button" onClick={() => setSelectedDistanceKm("all")}>
                            Show all
                          </button>
                        )}
                      </div>
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
                            <input type="number" name="rentalDays" value={rentFormState.rentalDays} onChange={handleRentInputChange} min="1" max="15" placeholder="3" required />
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
                                {item.distanceKm !== undefined && <span className="tag">{item.distanceKm} km away</span>}
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
                      <div className="empty-state">
                        {searchLocation && selectedDistanceKm !== "all"
                          ? `No ${selectedCategory === "all" ? "items" : `${selectedCategory.toLowerCase()} items`} found within ${searchRadiusKm} km. Try another category or show all items.`
                          : "No items found for this category."}
                      </div>
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
                        <div className="password-input-wrapper">
                          <input
                            type={showAdminDeliveryPassword ? "text" : "password"}
                            name="password"
                            value={adminDeliveryForm.password}
                            onChange={handleAdminInputChange}
                            placeholder="Min 6 chars"
                            minLength="6"
                            required
                          />
                          <button
                            type="button"
                            className="password-visibility-toggle"
                            onClick={() => setShowAdminDeliveryPassword((visible) => !visible)}
                            aria-label={`${showAdminDeliveryPassword ? "Hide" : "Show"} password`}
                            title={`${showAdminDeliveryPassword ? "Hide" : "Show"} password`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              {showAdminDeliveryPassword ? (
                                <>
                                  <path d="M3 3l18 18" />
                                  <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                                  <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3" />
                                  <path d="M6.2 6.2C3.9 7.7 2.8 10 2.5 12c1 2.5 4.5 7 9.5 7 1.3 0 2.5-.3 3.5-.8" />
                                </>
                              ) : (
                                <>
                                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                                  <circle cx="12" cy="12" r="3" />
                                </>
                              )}
                            </svg>
                          </button>
                        </div>
                      </label>
                      <label>
                        <span>Confirm password</span>
                        <div className="password-input-wrapper">
                          <input
                            type={showAdminDeliveryConfirmPassword ? "text" : "password"}
                            value={adminDeliveryConfirmPassword}
                            onChange={(event) => setAdminDeliveryConfirmPassword(event.target.value)}
                            placeholder="Re-enter password"
                            minLength="6"
                            required
                          />
                          <button
                            type="button"
                            className="password-visibility-toggle"
                            onClick={() => setShowAdminDeliveryConfirmPassword((visible) => !visible)}
                            aria-label={`${showAdminDeliveryConfirmPassword ? "Hide" : "Show"} confirm password`}
                            title={`${showAdminDeliveryConfirmPassword ? "Hide" : "Show"} confirm password`}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              {showAdminDeliveryConfirmPassword ? (
                                <>
                                  <path d="M3 3l18 18" />
                                  <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                                  <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7-.4 1-1.2 2.2-2.3 3.3" />
                                  <path d="M6.2 6.2C3.9 7.7 2.8 10 2.5 12c1 2.5 4.5 7 9.5 7 1.3 0 2.5-.3 3.5-.8" />
                                </>
                              ) : (
                                <>
                                  <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                                  <circle cx="12" cy="12" r="3" />
                                </>
                              )}
                            </svg>
                          </button>
                        </div>
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
                {!editingItemId && <p className="section-note full-width">Your browser will ask to use this device's location when you publish, so nearby renters can find this item.</p>}
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
                  <h3>Your orders</h3>
                </div>
              </div>

              <div className="order-view-toggle">
                <button
                  type="button"
                  className={`order-toggle-btn ${orderView === "you-rent" ? "is-active" : ""}`}
                  onClick={() => setOrderView("you-rent")}
                  aria-pressed={orderView === "you-rent"}
                >
                  <span className="toggle-icon">🛒</span>
                  <span className="toggle-label">You Rent</span>
                  <span className="toggle-count">{youRentOrders.length}</span>
                </button>
                <button
                  type="button"
                  className={`order-toggle-btn ${orderView === "your-rent" ? "is-active" : ""}`}
                  onClick={() => setOrderView("your-rent")}
                  aria-pressed={orderView === "your-rent"}
                >
                  <span className="toggle-icon">📦</span>
                  <span className="toggle-label">Your Rent</span>
                  <span className="toggle-count">{yourRentOrders.length}</span>
                </button>
                <button
                  type="button"
                  className={`order-toggle-btn ${orderView === "money" ? "is-active" : ""}`}
                  onClick={() => {
                    setOrderView("money");
                    if (!sellerEarningsData) fetchSellerEarnings();
                  }}
                  title="90% of rent amount will add after complete delivery"
                  aria-pressed={orderView === "money"}
                >
                  <span className="toggle-icon">💰</span>
                  <span className="toggle-label">Money</span>
                </button>
              </div>

              {orderView === "money" && (
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

              {orderView !== "money" && (
                <p className="section-note order-view-desc">
                  {orderView === "you-rent"
                    ? "Products you have rented from other users."
                    : "Your products that someone else has currently rented."}
                </p>
              )}

              {orderView !== "money" && (activeOrders.length ? (
                <div className="card-grid order-card-grid">
                  {activeOrders.map((order) => (
                    <article key={order._id} className="info-card order-info-card">
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
                          {order.deliveredToRenterAt && (
                            <span>
                              Rented till: {new Date(
                                new Date(order.deliveredToRenterAt).getTime()
                                + (order.renter?.rentalDays || 0) * 24 * 60 * 60 * 1000
                              ).toLocaleDateString()}
                            </span>
                          )}
                          <span>Delivery partner: {order.deliveryPartner?.username || "Waiting for partner"}</span>
                        </div>
                        <div className="delivery-stages-mini">
                          <span className={`stage-dot ${order.pickedUpFromSellerAt ? "is-done" : ""}`} title="Picked up from seller">1</span>
                          <span className={`stage-dot ${order.deliveredToRenterAt ? "is-done" : ""}`} title="Delivered to renter">2</span>
                          <span className={`stage-dot ${order.pickedUpFromRenterAt ? "is-done" : ""}`} title="Picked up from renter">3</span>
                          <span className={`stage-dot ${order.returnedToSellerAt ? "is-done" : ""}`} title="Returned to owner">4</span>
                          {orderView === "you-rent" && order.status === "DeliveredToRenter" && (order.renter?.rentalDays || 0) < 20 && getRentalEndDate(order) > new Date() && (
                            <button
                              type="button"
                              className="rental-extension-toggle"
                              aria-label={isRentalExtensionOpen[order._id] ? "Hide rental extension" : "Extend rental"}
                              aria-expanded={!!isRentalExtensionOpen[order._id]}
                              onClick={() => setIsRentalExtensionOpen((current) => ({
                                ...current,
                                [order._id]: !current[order._id],
                              }))}
                            >
                              +
                            </button>
                          )}
                        </div>
                        {orderView === "you-rent" && isRentalExtensionOpen[order._id] && order.status === "DeliveredToRenter" && (order.renter?.rentalDays || 0) < 20 && getRentalEndDate(order) > new Date() && (
                          <form onSubmit={(e) => handleExtendRental(e, order)} style={{ display: "flex", alignItems: "flex-end", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
                            <label style={{ flex: "1 1 180px" }}>
                              <span style={{ display: "block", marginBottom: "4px", fontSize: "0.9rem" }}>Extend rental (up to 20 total days)</span>
                              <input
                                type="number"
                                name="rentalDays"
                                min={(order.renter?.rentalDays || 0) + 1}
                                max="20"
                                value={rentalExtensionDays[order._id] ?? String((order.renter?.rentalDays || 0) + 1)}
                                onChange={(e) => setRentalExtensionDays((current) => ({
                                  ...current,
                                  [order._id]: e.target.value,
                                }))}
                                required
                                style={{ width: "100%", padding: "8px" }}
                              />
                            </label>
                            <button type="submit" className="secondary-button" disabled={submitting}>
                              Extend rental
                            </button>
                          </form>
                        )}
                        {orderView === "you-rent" && order.status !== "Placed" && !order.isPaid && (
                          <div style={{ marginTop: "16px" }}>
                            <button type="button" className="primary-button" onClick={() => handlePayment(order)} disabled={submitting}>
                              Pay ₹{(Math.max(0, (order.renter?.rentalDays || 1) - (order.paidRentalDays || 0)) * order.item.rentCost) + ((order.paidRentalDays || 0) === 0 ? (order.deliveryCharge || 0) : 0)} Now
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
              ))}
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
                            Rented till: {getRentalEndDate(order)?.toLocaleDateString() || "Not available"}
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
                              disabled={!canChangeStatus || !order.deliveredToRenterAt || !!order.pickedUpFromRenterAt || (currentUser?.role === "delivery" && !order.isPaid) || submitting}
                              onChange={() => handleUpdateOrderStatus(order._id, "PickedUpFromRenter")}
                            />
                            <span>3. Pickup from Renter</span>
                          </label>
                          <label className={`check-item ${order.returnedToSellerAt ? "is-done" : ""}`}>
                            <input
                              type="checkbox"
                              checked={!!order.returnedToSellerAt}
                              disabled={!canChangeStatus || !order.pickedUpFromRenterAt || !!order.returnedToSellerAt || (currentUser?.role === "delivery" && !order.isPaid) || submitting}
                              onChange={() => handleUpdateOrderStatus(order._id, "ReturnedToSeller")}
                            />
                            <span>4. Return to Owner</span>
                          </label>
                          {currentUser?.role === "delivery" && !order.isPaid && (
                            <p className="section-note">Payment is required before steps 3 and 4 can be completed.</p>
                          )}
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
                              editingDeliveryChargeOrderId === order._id ? (
                                <form
                                  className="card-actions"
                                  onSubmit={(event) => handleSetDeliveryCharge(event, order._id)}
                                  style={{ marginTop: 0, alignItems: "flex-end" }}
                                >
                                  <label>
                                    <span>Delivery charge (₹)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={deliveryChargeInput}
                                      onChange={(event) => setDeliveryChargeInput(event.target.value)}
                                      required
                                      disabled={submitting}
                                    />
                                  </label>
                                  <button type="submit" className="primary-button" disabled={submitting}>
                                    {submitting ? "Saving..." : "Save charge"}
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setEditingDeliveryChargeOrderId("")}
                                    disabled={submitting}
                                  >
                                    Cancel
                                  </button>
                                </form>
                              ) : (
                                <button type="button" className="secondary-button" onClick={() => beginSetDeliveryCharge(order)} disabled={submitting}>
                                  Set Delivery Charge
                                </button>
                              )
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
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.request && !error.response) {
    return "Unable to reach the server. Check your connection and try again.";
  }

  return error?.message || fallbackMessage;
}
