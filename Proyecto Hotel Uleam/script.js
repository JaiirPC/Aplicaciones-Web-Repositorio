const { createApp } = Vue;

// Mapa de clases de estado, compartido entre la app principal y el componente room-status-badge
const MAPA_ESTADOS = {
    'Disponible': 'status-disponible', 'Reservada': 'status-reservada',
    'Mantenimiento': 'status-mantenimiento', 'No disponible': 'status-no-disponible',
    'Completada': 'status-completada', 'Autorizada': 'status-autorizada',
    'Activa': 'status-reservada', 'Cancelada': 'status-no-disponible'
};

// Imágenes de referencia por tamaño de habitación (fotos libres de Unsplash)
const IMAGENES_HABITACION = {
    'pequeña': 'https://images.unsplash.com/photo-1746549859840-808544238d42?q=80&w=1200&auto=format&fit=crop',
    'mediana': 'https://images.unsplash.com/photo-1702255489644-392758161f1f?q=80&w=1200&auto=format&fit=crop',
    'grande': 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?q=80&w=1200&auto=format&fit=crop',
    'default': 'https://images.unsplash.com/photo-1702255489644-392758161f1f?q=80&w=1200&auto=format&fit=crop'
};

const app = createApp({
    data() {
        return {
            rooms: [], clients: [], reservations: [], notifications: [],
            currentUser: null, currentRole: null, vistaActualAdmin: 'basic-info',
            // Estados de navegación propios de las páginas separadas client.html y admin.html
            // (no interfieren con vistaActualAdmin, que sigue controlando el panel embebido de index.html)
            panelClienteActivo: 'perfil', panelAdminActivo: 'gestion-habitaciones',
            loginUsuario: { email: '', pass: '' },
            loginAdmin: { user: '', pass: '' },
            registro: { id: '', firstname: '', lastname: '', email: '', phone: '', pass: '', passConfirm: '' },
            contacto: { nombre: '', telefono: '', correo: '', mensaje: '' },
            editRoomModel: { id: null, type: '', size: '', wifi: false, dinner: false, airConditioning: false, status: '', price: 0, schedule: '' },
            nuevaHabitacion: { type: 'Individual', size: '', price: 0, status: 'Disponible', wifi: false, airConditioning: false, dinner: false, schedule: '' },
            mostrarCardEdicion: false, notiModel: { resId: null, clientName: '', mensajeTexto: '' },
            mostrarCardNotificacion: false, nuevaReserva: { roomId: '', checkIn: '', checkOut: '' },
            reservaACancelarId: '',
            // Opiniones dejadas por los clientes al terminar una reservación
            reviews: [],
            // Snapshot del reporte de uso de habitaciones generado por el administrador
            reporteUso: [],
            mostrarCardTerminarReserva: false,
            terminarReservaModel: { resId: null, roomId: null, roomType: '', comentario: '' },
            erroresTerminarReserva: { comentario: false },
            // Controla si el modal de vista previa de habitación está abierto (se abre solo
            // al elegir una habitación, y se puede cerrar con el botón "Cerrar" sin perder la selección)
            mostrarPreviaHabitacion: false,
            // Estado del toast de feedback (reemplaza los alert())
            toast: { visible: false, texto: '', tipo: 'ok' },
            erroresLoginUsuario: { email: false, pass: false }, erroresAdmin: { user: false, pass: false },
            erroresRegistro: { id: false, firstname: false, lastname: false, email: false, phone: false, pass: false, passConfirm: false },
            erroresContacto: { nombre: false, telefono: false, correo: false, mensaje: false },
            erroresReserva: { room: false, entrada: false, salida: false },
            heroStyle: { backgroundImage: "linear-gradient(rgba(11,95,58,0.75), rgba(11,95,58,0.75)), url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1600')" }
        };
    },
    computed: {
        reporteTotalReservas() { return this.reservations.length; },
        reporteReservasActivas() { return this.reservations.filter(r => r.status === 'Activa' || r.status === 'Autorizada').length; },
        reporteHabitacionesDisponibles() { return this.rooms.filter(r => r.status === 'Disponible').length; },
        reporteIngresosEstimados() { return this.reservations.reduce((acc, curr) => { const r = this.rooms.find(rm => rm.id === curr.roomId); return acc + (r ? r.price : 0); }, 0); },
        habitacionesDisponibles() { return this.rooms.filter(r => r.status === 'Disponible'); },
        habitacionesReservadasCount() { return this.rooms.filter(r => r.status === 'Reservada').length; },
        misReservasActivas() { return !this.currentUser ? [] : this.reservations.filter(r => r.clientEmail === this.currentUser.email && r.status === 'Activa'); },
        misReservasHistorial() { return !this.currentUser ? [] : this.reservations.filter(r => r.clientEmail === this.currentUser.email); },
        misNotificaciones() { return !this.currentUser ? [] : this.notifications.filter(n => n.clientEmail === this.currentUser.email); },
        // Habitación elegida en el formulario de reserva (para mostrar la vista previa con imagen)
        habitacionSeleccionada() {
            if (!this.nuevaReserva.roomId) return null;
            return this.rooms.find(r => r.id === parseInt(this.nuevaReserva.roomId)) || null;
        }
    },
    watch: {
        // Estos watch SOLO limpian un error ya mostrado en cuanto el campo vuelve a ser válido.
        // Nunca activan un error nuevo mientras el usuario escribe por primera vez, así que
        // el comportamiento de "validar al enviar" (submit) sigue siendo exactamente el mismo.
        'registro.id'(val) { if (this.erroresRegistro.id) this.erroresRegistro.id = val.length !== 10; },
        'registro.firstname'(val) { if (this.erroresRegistro.firstname) this.erroresRegistro.firstname = val.trim() === ''; },
        'registro.lastname'(val) { if (this.erroresRegistro.lastname) this.erroresRegistro.lastname = val.trim() === ''; },
        'registro.email'(val) { if (this.erroresRegistro.email) this.erroresRegistro.email = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val); },
        'registro.phone'(val) { if (this.erroresRegistro.phone) this.erroresRegistro.phone = val.length !== 10; },
        'registro.pass'(val) { if (this.erroresRegistro.pass) this.erroresRegistro.pass = val.length < 6; },
        'registro.passConfirm'(val) { if (this.erroresRegistro.passConfirm) this.erroresRegistro.passConfirm = (val !== this.registro.pass) || val === ''; },
        'contacto.nombre'(val) { if (this.erroresContacto.nombre) this.erroresContacto.nombre = val.trim() === ''; },
        'contacto.telefono'(val) { if (this.erroresContacto.telefono) this.erroresContacto.telefono = val.length < 7; },
        'contacto.correo'(val) { if (this.erroresContacto.correo) this.erroresContacto.correo = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val); },
        'contacto.mensaje'(val) { if (this.erroresContacto.mensaje) this.erroresContacto.mensaje = val.trim() === ''; },
        'nuevaReserva.roomId'(val) {
            if (this.erroresReserva.room) this.erroresReserva.room = val === '';
            // Al elegir una habitación se abre el modal de vista previa; al quitar la selección se cierra.
            this.mostrarPreviaHabitacion = val !== '';
        },
        'nuevaReserva.checkIn'(val) { if (this.erroresReserva.entrada) this.erroresReserva.entrada = val === ''; },
        'nuevaReserva.checkOut'(val) { if (this.erroresReserva.salida) this.erroresReserva.salida = val === ''; },
        'loginUsuario.email'(val) { if (this.erroresLoginUsuario.email) this.erroresLoginUsuario.email = val.trim() === ''; },
        'loginUsuario.pass'(val) { if (this.erroresLoginUsuario.pass) this.erroresLoginUsuario.pass = val.trim() === ''; },
        'loginAdmin.user'(val) { if (this.erroresAdmin.user) this.erroresAdmin.user = val.trim() === ''; },
        'loginAdmin.pass'(val) { if (this.erroresAdmin.pass) this.erroresAdmin.pass = val.trim() === ''; }
    },
    methods: {
        cargarDatosDeAlmacenamiento() {
            const DEFAULT_CLIENTS = [{ "id": "C001", "firstName": "Carla", "lastName": "Gómez", "name": "Carla Gómez", "email": "carla.gomez@uleam.ec", "phone": "0987654321", "password": "cliente123", "role": "Cliente", "fechaRegistro": "15/01/2024" }];
            const DEFAULT_ROOMS = [
                { "id": 101, "type": "Individual", "size": "Pequeña", "wifi": true, "dinner": false, "airConditioning": false, "status": "Disponible", "price": 35 },
                { "id": 102, "type": "Doble", "size": "Mediana", "wifi": true, "dinner": true, "airConditioning": true, "status": "Reservada", "price": 50 },
                { "id": 103, "type": "Familiar", "size": "Grande", "wifi": true, "dinner": true, "airConditioning": false, "status": "Mantenimiento", "price": 80 },
                { "id": 104, "type": "Suite", "size": "Grande", "wifi": true, "dinner": true, "airConditioning": true, "status": "Disponible", "price": 110 }
            ];
            this.rooms = JSON.parse(localStorage.getItem('hotel_rooms')) || DEFAULT_ROOMS;
            this.clients = JSON.parse(localStorage.getItem('hotel_clients')) || DEFAULT_CLIENTS;
            this.reservations = JSON.parse(localStorage.getItem('hotel_reservations')) || [];
            this.notifications = JSON.parse(localStorage.getItem('hotel_notifications')) || [];
            this.reviews = JSON.parse(localStorage.getItem('hotel_reviews')) || [];
            this.reporteUso = JSON.parse(localStorage.getItem('hotel_reporte_uso')) || [];
            this.guardarEnStorage();
            this.cargarSesion();
        },
        guardarEnStorage() {
            localStorage.setItem('hotel_rooms', JSON.stringify(this.rooms));
            localStorage.setItem('hotel_clients', JSON.stringify(this.clients));
            localStorage.setItem('hotel_reservations', JSON.stringify(this.reservations));
            localStorage.setItem('hotel_notifications', JSON.stringify(this.notifications));
            localStorage.setItem('hotel_reviews', JSON.stringify(this.reviews));
            localStorage.setItem('hotel_reporte_uso', JSON.stringify(this.reporteUso));
        },
        // La sesión (quién está logeado) se guarda aparte para que index.html, client.html
        // y admin.html —que son páginas independientes— reconozcan al mismo usuario.
        cargarSesion() {
            const sesion = JSON.parse(localStorage.getItem('hotel_session'));
            if (sesion && sesion.currentUser && sesion.currentRole) {
                this.currentUser = sesion.currentUser;
                this.currentRole = sesion.currentRole;
            }
        },
        guardarSesion() {
            localStorage.setItem('hotel_session', JSON.stringify({ currentUser: this.currentUser, currentRole: this.currentRole }));
        },
        borrarSesion() { localStorage.removeItem('hotel_session'); },
        mostrarLoginUsuario() { this.currentRole = 'LoginCliente'; this.limpiarErrores(); },
        mostrarLoginAdmin() { this.currentRole = 'LoginAdmin'; this.limpiarErrores(); },
        mostrarRegistroUsuario() { this.currentRole = 'RegistroCliente'; this.limpiarErrores(); },
        volverALogin() { this.currentRole = null; },
        cerrarSesion() { this.currentUser = null; this.currentRole = null; this.borrarSesion(); },
        // Muestra un mensaje flotante (toast) en vez de alert(). tipo: 'ok' | 'error'
        notificar(texto, tipo = 'ok') {
            this.toast = { visible: true, texto, tipo };
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => { this.toast.visible = false; }, 3200);
        },
        limpiarMisNotificaciones() {
            // Filtramos el arreglo general para quedarnos SOLO con las notificaciones de los demás usuarios
            this.notifications = this.notifications.filter(n => n.clientEmail !== this.currentUser.email);
            this.guardarEnStorage();
            this.notificar("Notificaciones marcadas como leídas.");
        },
        validarLoginUsuario() {
            this.erroresLoginUsuario.email = this.loginUsuario.email.trim() === '';
            this.erroresLoginUsuario.pass = this.loginUsuario.pass.trim() === '';
            if (this.erroresLoginUsuario.email || this.erroresLoginUsuario.pass) return;
            // Antes se buscaba solo por contraseña, lo que confundía cuentas con la misma contraseña.
            // Ahora se identifica al cliente por su correo y se valida la contraseña de ESE cliente.
            const cliente = this.clients.find(c => c.email.toLowerCase() === this.loginUsuario.email.trim().toLowerCase());
            if (cliente && cliente.password === this.loginUsuario.pass) {
                this.currentUser = cliente; this.currentRole = 'Cliente'; this.loginUsuario = { email: '', pass: '' }; this.guardarSesion();
            } else {
                this.notificar("Correo o contraseña incorrectos.", "error");
            }
        },
        validarLoginAdmin() {
            this.erroresAdmin.user = this.loginAdmin.user.trim() === '';
            this.erroresAdmin.pass = this.loginAdmin.pass.trim() === '';
            if (this.erroresAdmin.user || this.erroresAdmin.pass) return;
            if (this.loginAdmin.user === 'admin' && this.loginAdmin.pass === 'admin123') {
                this.currentUser = { name: 'Administrador ULEAM' }; this.currentRole = 'Admin'; this.loginAdmin = { user: '', pass: '' }; this.guardarSesion();
            } else { this.notificar("Credenciales incorrectas.", "error"); }
        },
        registrarUsuario() {
            const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            // Validaciones estrictas
            this.erroresRegistro.id = this.registro.id.length !== 10;
            this.erroresRegistro.firstname = this.registro.firstname.trim() === '';
            this.erroresRegistro.lastname = this.registro.lastname.trim() === '';
            this.erroresRegistro.email = !regexEmail.test(this.registro.email);
            this.erroresRegistro.phone = this.registro.phone.length !== 10;
            this.erroresRegistro.pass = this.registro.pass.length < 6;
            this.erroresRegistro.passConfirm = this.registro.pass !== this.registro.passConfirm || this.registro.passConfirm === '';

            if (Object.values(this.erroresRegistro).includes(true)) return;

            // Evita que dos cuentas distintas compartan el mismo correo (el correo es el
            // identificador que ahora usa el login, así que debe ser único).
            const correoDuplicado = this.clients.some(c => c.email.toLowerCase() === this.registro.email.trim().toLowerCase());
            if (correoDuplicado) {
                this.notificar("Ese correo ya está registrado. Inicia sesión o usa otro correo.", "error");
                return;
            }

            const nuevoCliente = {
                id: this.registro.id, firstName: this.registro.firstname, lastName: this.registro.lastname,
                name: `${this.registro.firstname} ${this.registro.lastname}`, email: this.registro.email,
                phone: this.registro.phone, password: this.registro.pass, role: "Cliente",
                fechaRegistro: new Date().toLocaleDateString()
            };
            this.clients.push(nuevoCliente); this.guardarEnStorage();
            this.notificar("¡Registro exitoso! Ya puedes iniciar sesión con tu contraseña.");
            this.registro = { id: '', firstname: '', lastname: '', email: '', phone: '', pass: '', passConfirm: '' };
            this.mostrarLoginUsuario();
        },
        validarContacto() {
            this.erroresContacto.nombre = this.contacto.nombre.trim() === '';
            this.erroresContacto.telefono = this.contacto.telefono.length < 7;
            this.erroresContacto.correo = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.contacto.correo);
            this.erroresContacto.mensaje = this.contacto.mensaje.trim() === '';
            if (Object.values(this.erroresContacto).includes(true)) return;
            this.notificar("Mensaje enviado con éxito.");
            this.contacto = { nombre: '', telefono: '', correo: '', mensaje: '' };
        },
        procesarReserva() {
            this.erroresReserva.room = this.nuevaReserva.roomId === '';
            this.erroresReserva.entrada = this.nuevaReserva.checkIn === '';
            this.erroresReserva.salida = this.nuevaReserva.checkOut === '';
            if (Object.values(this.erroresReserva).includes(true)) return;
            const rId = parseInt(this.nuevaReserva.roomId);
            const reserva = { id: Date.now(), clientEmail: this.currentUser.email, clientName: this.currentUser.name, roomId: rId, checkIn: this.nuevaReserva.checkIn, checkOut: this.nuevaReserva.checkOut, status: 'Activa' };
            const roomIndex = this.rooms.findIndex(rm => rm.id === rId);
            if (roomIndex !== -1) this.rooms[roomIndex].status = 'Reservada';
            this.reservations.push(reserva); this.guardarEnStorage();
            this.notificar("¡Habitación reservada con éxito!"); this.nuevaReserva = { roomId: '', checkIn: '', checkOut: '' };
        },
        ejecutarCancelarReserva() {
            if (!this.reservaACancelarId) { this.notificar("Selecciona una reserva para cancelarla.", "error"); return; }
            this.forzarCancelarReservaDirecta(parseInt(this.reservaACancelarId)); this.reservaACancelarId = '';
        },
        forzarCancelarReservaDirecta(resId) {
            const resIdx = this.reservations.findIndex(r => r.id === resId);
            if (resIdx !== -1) {
                const roomID = this.reservations[resIdx].roomId;
                this.reservations[resIdx].status = 'Cancelada';
                const roomIdx = this.rooms.findIndex(rm => rm.id === roomID);
                if (roomIdx !== -1) this.rooms[roomIdx].status = 'Disponible';
                this.guardarEnStorage(); this.notificar("La reserva ha sido cancelada.");
            }
        },
        cambiarTabAdmin(tabId) { this.vistaActualAdmin = tabId; },
        // Tabs de la página separada admin.html (usa su propio set de nombres de pestaña)
        cambiarPanelAdmin(tabId) { this.panelAdminActivo = tabId; },
        // Tabs de la página separada client.html
        cambiarTabCliente(tabId) { this.panelClienteActivo = tabId; },
        initAdminRoomEdit(room) { this.editRoomModel = { ...room }; this.mostrarCardEdicion = true; },
        cancelAdminEditRoom() { this.mostrarCardEdicion = false; },
        guardarCambiosHabitacion() {
            const idx = this.rooms.findIndex(r => r.id === this.editRoomModel.id);
            if (idx !== -1) { this.rooms[idx] = { ...this.editRoomModel }; this.guardarEnStorage(); this.notificar(`Habitación ${this.editRoomModel.id} actualizada.`); this.mostrarCardEdicion = false; }
        },
        adminAddRoom() {
            if (!this.nuevaHabitacion.size || !this.nuevaHabitacion.size.trim()) { this.notificar("Indica el tamaño de la habitación.", "error"); return; }
            if (!this.nuevaHabitacion.price || this.nuevaHabitacion.price <= 0) { this.notificar("Indica un precio válido.", "error"); return; }
            const nuevoId = this.rooms.length ? Math.max(...this.rooms.map(r => r.id)) + 1 : 101;
            const habitacion = { id: nuevoId, ...this.nuevaHabitacion, price: Number(this.nuevaHabitacion.price) };
            this.rooms.push(habitacion); this.guardarEnStorage();
            this.notificar(`Habitación ${nuevoId} agregada con éxito.`);
            this.nuevaHabitacion = { type: 'Individual', size: '', price: 0, status: 'Disponible', wifi: false, airConditioning: false, dinner: false, schedule: '' };
        },
        eliminarHabitacion(id) {
            if (!confirm(`¿Seguro que deseas eliminar la habitación ${id}?`)) return;
            this.rooms = this.rooms.filter(r => r.id !== id);
            this.guardarEnStorage();
        },
        // Cancela la primera reserva activa del cliente actual (usado por el botón "Cancelar Reserva Activa")
        cancelarReservaClienteActiva() {
            const activa = this.misReservasActivas[0];
            if (!activa) { this.notificar("No tienes ninguna reserva activa para cancelar.", "error"); return; }
            this.forzarCancelarReservaDirecta(activa.id);
        },
        // Abre el modal para "Terminar Reservación": a diferencia de Cancelar, esto se usa
        // cuando el cliente YA se hospedó y quiere finalizar dejando una opinión sobre la habitación.
        abrirTerminarReserva(res) {
            const room = this.rooms.find(rm => rm.id === res.roomId);
            this.terminarReservaModel = { resId: res.id, roomId: res.roomId, roomType: room ? room.type : '', comentario: '' };
            this.erroresTerminarReserva.comentario = false;
            this.mostrarCardTerminarReserva = true;
        },
        confirmarTerminarReserva() {
            this.erroresTerminarReserva.comentario = this.terminarReservaModel.comentario.trim() === '';
            if (this.erroresTerminarReserva.comentario) return;
            const resIdx = this.reservations.findIndex(r => r.id === this.terminarReservaModel.resId);
            if (resIdx === -1) return;
            this.reservations[resIdx].status = 'Completada';
            const roomIdx = this.rooms.findIndex(rm => rm.id === this.reservations[resIdx].roomId);
            if (roomIdx !== -1) this.rooms[roomIdx].status = 'Disponible';
            this.reviews.push({
                id: Date.now(),
                clientEmail: this.currentUser.email,
                clientName: this.currentUser.name,
                roomId: this.terminarReservaModel.roomId,
                roomType: this.terminarReservaModel.roomType,
                comentario: this.terminarReservaModel.comentario,
                fecha: new Date().toLocaleDateString()
            });
            this.guardarEnStorage();
            this.mostrarCardTerminarReserva = false;
            this.notificar("¡Gracias por tu opinión! Reservación terminada.");
        },
        // Junta los datos de cliente + reserva (nombre, apellido, correo, habitación, fechas) y los
        // guarda como un reporte fijo que el administrador puede consultar en Reportes.
        generarReporteUso() {
            this.reporteUso = this.reservations.map(r => {
                const cliente = this.clients.find(c => c.email === r.clientEmail) || {};
                const nombre = cliente.firstName || (cliente.name ? cliente.name.split(' ')[0] : '');
                const apellido = cliente.lastName || (cliente.name ? cliente.name.split(' ').slice(1).join(' ') : '');
                return {
                    id: r.id, nombre, apellido, correo: r.clientEmail,
                    habitacion: r.roomId, checkIn: r.checkIn, checkOut: r.checkOut, estado: r.status
                };
            });
            this.guardarEnStorage();
            this.notificar("Reporte de uso generado y guardado.");
        },
        // Devuelve la clase CSS ya definida en styles.css para pintar cada estado (room-status)
        // Cierra el modal de vista previa sin borrar la habitación ya seleccionada en el formulario
        cerrarPreviaHabitacion() { this.mostrarPreviaHabitacion = false; },
        // Devuelve la imagen correspondiente al tamaño de la habitación (Pequeña, Mediana, Grande)
        imagenHabitacion(size) {
            const key = (size || '').trim().toLowerCase();
            return IMAGENES_HABITACION[key] || IMAGENES_HABITACION.default;
        },
        descripcionHabitacion(room) {
            return `Esta habitación ${room.type.toLowerCase()} dispone de mobiliario confortable, cuenta con todo lo necesario para garantizar una experiencia única e inolvidable.`;
        },
        capacidadHabitacion(room) {
            const mapa = { 'Individual': '1 persona', 'Doble': '2 personas', 'Familiar': '4 personas', 'Suite': '2 personas', 'Múltiple': '6 personas' };
            return mapa[room.type] || '2 personas';
        },
        detalleHabitacion(room) {
            const partes = [];
            if (room.wifi) partes.push('Wi-Fi incluido');
            if (room.airConditioning) partes.push('Aire acondicionado');
            if (room.dinner) partes.push('Cena incluida');
            if (room.schedule) partes.push(`Horario: ${room.schedule}`);
            return partes.length ? partes.join(' · ') : 'Habitación equipada con lo esencial para tu estadía.';
        },
        claseEstado(status) {
            return MAPA_ESTADOS[status] || 'status-otro';
        },
        openAdminMessage(res) { this.notiModel.resId = res.id; this.notiModel.clientName = res.clientName; this.notiModel.mensajeTexto = ''; this.mostrarCardNotificacion = true; },
        confirmAdminSendReservationMessage() {
            if (!this.notiModel.mensajeTexto.trim()) { this.notificar("Escribe un mensaje.", "error"); return; }
            const res = this.reservations.find(r => r.id === this.notiModel.resId);
            if (res) { this.notifications.push({ id: Date.now(), clientEmail: res.clientEmail, roomId: res.roomId, text: this.notiModel.mensajeTexto, date: new Date().toLocaleDateString() }); this.guardarEnStorage(); this.notificar("Notificación enviada."); this.mostrarCardNotificacion = false; }
        },
        setHeroBackground(url) { this.heroStyle.backgroundImage = url ? `linear-gradient(rgba(11,95,58,0.75), rgba(11,95,58,0.75)), url('${url}')` : "linear-gradient(rgba(11,95,58,0.75), rgba(11,95,58,0.75)), url('https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200')"; },
        handleBgUpload(event) { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => this.setHeroBackground(e.target.result); reader.readAsDataURL(file); } },
        limpiarErrores() { Object.keys(this.erroresLoginUsuario).forEach(k => this.erroresLoginUsuario[k] = false); Object.keys(this.erroresAdmin).forEach(k => this.erroresAdmin[k] = false); Object.keys(this.erroresRegistro).forEach(k => this.erroresRegistro[k] = false); },
        
        // --- FILTROS DE TECLADO EN TIEMPO REAL ---
        filtrarEntradaNumeros(event, modelo, campo) {
            this[modelo][campo] = event.target.value.replace(/\D/g, '');
        },
        filtrarEntradaLetras(event, modelo, campo) {
            this[modelo][campo] = event.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        }
    },
    mounted() { this.cargarDatosDeAlmacenamiento(); }
});

// Componente reutilizable para el badge de estado (usado en admin.html, client.html).
// Usa exactamente las mismas clases CSS que ya existían (.room-status, .status-*),
// así que no cambia nada visualmente, solo evita repetir la misma etiqueta en cada tabla.
app.component('room-status-badge', {
    props: { status: { type: String, required: true } },
    computed: {
        claseCSS() { return MAPA_ESTADOS[this.status] || 'status-otro'; }
    },
    template: `<span class="room-status" :class="claseCSS">{{ status }}</span>`
});

app.mount('#app');














