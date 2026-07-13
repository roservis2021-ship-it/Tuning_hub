import logo from '../assets/logo-tuning-hub.png';

function MaintenancePage() {
  return (
    <main className="maintenance-page" aria-labelledby="maintenance-title">
      <section className="maintenance-hero">
        <div className="maintenance-brand" aria-label="Tuning HUB">
          <img src={logo} alt="" />
          <span>Tuning HUB</span>
        </div>

        <div className="maintenance-copy">
          <p className="maintenance-status">Mantenimiento activo</p>
          <h1 id="maintenance-title">Estamos ajustando la web para volver finos.</h1>
          <p>
            Hemos pausado temporalmente Tuning HUB para revisar la experiencia y evitar
            que nadie use una version que no esta funcionando como deberia.
          </p>
        </div>

        <div className="maintenance-note">
          <strong>Volvemos pronto.</strong>
          <span>Gracias por la paciencia mientras dejamos la plataforma a la altura.</span>
        </div>
      </section>
    </main>
  );
}

export default MaintenancePage;
